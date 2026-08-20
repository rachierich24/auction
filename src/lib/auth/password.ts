import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// OWASP-recommended scrypt parameters (N=2^17, r=8, p=1).
const PARAMS = { N: 131_072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEY_LENGTH = 64;

/**
 * Hashes with scrypt from node:crypto — no native build step, memory-hard,
 * and the parameters are embedded so they can be raised later without
 * invalidating existing hashes.
 *
 * Format: scrypt$N$r$p$<salt-hex>$<hash-hex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(
    password.normalize("NFKC"),
    salt,
    KEY_LENGTH,
    PARAMS,
  );
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt") return false;

    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 256 * 1024 * 1024,
    });

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Burns roughly the same time as a real verification so that a request for a
 * non-existent account is indistinguishable from a wrong password.
 */
export async function fakeVerifyDelay(): Promise<void> {
  await scryptAsync("dummy-password", randomBytes(16), KEY_LENGTH, PARAMS).catch(
    () => undefined,
  );
}

export function passwordStrengthIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 10) issues.push("Use at least 10 characters.");
  if (!/[a-z]/.test(password)) issues.push("Include a lowercase letter.");
  if (!/[A-Z]/.test(password)) issues.push("Include an uppercase letter.");
  if (!/\d/.test(password)) issues.push("Include a number.");
  return issues;
}
