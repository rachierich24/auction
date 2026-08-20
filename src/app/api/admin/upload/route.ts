import { NextResponse } from "next/server";

import { assertPermission, AuthenticationError, AuthorizationError } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";
import { limit, rateKey, RATE_LIMITS } from "@/lib/rate-limit";
import { assertSameOrigin, clientIp } from "@/lib/request";
import {
  MAX_UPLOAD_BYTES,
  prepareUpload,
  storage,
  UploadRejectedError,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lot media upload.
 *
 * Defences, in order: same-origin, authenticated with `auction.update`, rate
 * limited, size capped, and the file's own magic number decides its type — the
 * browser-supplied MIME type and filename are discarded. The storage key is
 * generated, so a crafted filename cannot escape the upload root.
 *
 * Binaries go to object storage; the database only ever holds the URL.
 */
export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const user = await assertPermission("auction.update");

    const ip = await clientIp();
    const gate = limit(rateKey("upload", ip, user.id), RATE_LIMITS.upload);
    if (!gate.ok) {
      return NextResponse.json(
        { error: `Too many uploads. Try again in ${gate.retryAfterSeconds}s.` },
        { status: 429 },
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_UPLOAD_BYTES * 1.1) {
      return NextResponse.json(
        { error: "That file is too large." },
        { status: 413 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was received." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { key, contentType } = prepareUpload(buffer, file.type, "auctions");

    const stored = await storage().put({ key, body: buffer, contentType });

    await recordAudit({
      actorId: user.id,
      action: "media.upload",
      entityType: "auction_image",
      entityId: null,
      metadata: { key: stored.key, size: stored.size, contentType },
      ip,
    });

    return NextResponse.json({
      url: stored.url,
      key: stored.key,
      size: stored.size,
      contentType: stored.contentType,
    });
  } catch (error) {
    if (error instanceof UploadRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.startsWith("Request rejected")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("[upload] failed", error);
    return NextResponse.json(
      { error: "The upload failed. Please try again." },
      { status: 500 },
    );
  }
}
