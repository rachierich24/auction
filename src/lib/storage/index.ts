import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Object storage behind a narrow interface. Binaries never touch the database —
 * only the resulting public URL is persisted on `auction_images.url`.
 *
 * `local` writes to ./public/uploads for zero-config development. Set
 * STORAGE_DRIVER=s3 or =supabase with the matching credentials for production.
 */

export type StoredObject = {
  url: string;
  key: string;
  size: number;
  contentType: string;
};

export interface StorageDriver {
  readonly name: string;
  put(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject>;
  remove(key: string): Promise<void>;
}

// -- Upload policy ----------------------------------------------------------

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Magic-number check. The browser-supplied MIME type and filename are both
 * attacker-controlled, so the file's own header is what decides.
 */
export function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";

  const ftyp = buffer.subarray(4, 8).toString("ascii");
  if (ftyp === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "image/avif";
  }

  return null;
}

export class UploadRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadRejectedError";
  }
}

/**
 * Validates a browser-uploaded file and returns a safe storage key.
 * Filenames from the client are discarded entirely — the key is generated —
 * which removes path traversal and double-extension tricks as a class.
 */
export function prepareUpload(
  buffer: Buffer,
  declaredType: string,
  prefix = "auctions",
): { key: string; contentType: string } {
  if (buffer.length === 0) {
    throw new UploadRejectedError("The file is empty.");
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadRejectedError(
      `Images must be ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB or smaller.`,
    );
  }

  const sniffed = sniffImageType(buffer);
  if (!sniffed) {
    throw new UploadRejectedError("That file is not a recognised image.");
  }
  if (!ALLOWED_IMAGE_TYPES.includes(sniffed as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new UploadRejectedError("Upload a JPEG, PNG, WebP or AVIF image.");
  }
  if (declaredType && declaredType !== sniffed) {
    // Not fatal — some browsers mislabel — but the sniffed type always wins.
    console.warn(
      `[storage] declared type ${declaredType} does not match sniffed ${sniffed}`,
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const id = randomBytes(12).toString("hex");
  return {
    key: `${prefix}/${stamp}/${id}.${EXTENSION[sniffed]}`,
    contentType: sniffed,
  };
}

// -- Drivers ----------------------------------------------------------------

const localDriver: StorageDriver = {
  name: "local",
  async put({ key, body, contentType }) {
    const target = path.join(process.cwd(), "public", "uploads", key);
    // Defence in depth: the key is generated, but never let one escape the root.
    const root = path.join(process.cwd(), "public", "uploads");
    if (!path.resolve(target).startsWith(path.resolve(root))) {
      throw new UploadRejectedError("Invalid storage key.");
    }

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);

    return { url: `/uploads/${key}`, key, size: body.length, contentType };
  },

  async remove(key) {
    const target = path.join(process.cwd(), "public", "uploads", key);
    await unlink(target).catch(() => undefined);
  },
};

const s3Driver: StorageDriver = {
  name: "s3",
  async put({ key, body, contentType }) {
    const bucket = process.env.S3_BUCKET;
    const base = process.env.S3_PUBLIC_BASE_URL;
    if (!bucket || !base) {
      throw new Error("S3_BUCKET and S3_PUBLIC_BASE_URL must be configured.");
    }
    // Install @aws-sdk/client-s3 and issue a PutObjectCommand here. Kept out of
    // the dependency tree until the driver is actually switched on.
    throw new Error(
      "The S3 driver needs @aws-sdk/client-s3. See src/lib/storage/index.ts.",
    );
  },
  async remove() {
    throw new Error("The S3 driver needs @aws-sdk/client-s3.");
  },
};

const supabaseDriver: StorageDriver = {
  name: "supabase",
  async put({ key, body, contentType }) {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "auction-media";
    if (!url || !serviceKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.",
      );
    }

    const endpoint = `${url.replace(/\/$/, "")}/storage/v1/object/${bucket}/${key}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: new Uint8Array(body),
    });

    if (!response.ok) {
      throw new Error(
        `Supabase Storage rejected the upload (${response.status}): ${await response.text()}`,
      );
    }

    return {
      url: `${url.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${key}`,
      key,
      size: body.length,
      contentType,
    };
  },

  async remove(key) {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "auction-media";
    if (!url || !serviceKey) return;

    await fetch(
      `${url.replace(/\/$/, "")}/storage/v1/object/${bucket}/${key}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${serviceKey}` } },
    ).catch(() => undefined);
  },
};

export function storage(): StorageDriver {
  switch (process.env.STORAGE_DRIVER) {
    case "s3":
      return s3Driver;
    case "supabase":
      return supabaseDriver;
    default:
      return localDriver;
  }
}

/** Stable cache-busting fingerprint for a stored object. */
export function fingerprint(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}
