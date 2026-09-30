import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcryptjs";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

// scrypt runs on Node's thread pool, so hashing a password doesn't freeze the server
// the way bcryptjs (pure JavaScript) does — many people signing up at once stay fast.
const N = 16384, R = 8, P = 1, KEYLEN = 32;

/** Hash a new password. Format: scrypt$N$r$p$salt$hash (all base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/**
 * Checks a password against a stored hash. Accepts both the new scrypt format and
 * the old bcrypt hashes already in the database; `needsUpgrade` tells the caller
 * to re-save the password in the new format (done silently at login).
 */
export async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (stored.startsWith("scrypt$")) {
    const [, n, r, p, salt, hash] = stored.split("$");
    const expected = Buffer.from(hash, "base64url");
    const key = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    return { ok: key.length === expected.length && timingSafeEqual(key, expected), needsUpgrade: false };
  }
  const ok = await bcrypt.compare(password, stored); // legacy hash
  return { ok, needsUpgrade: ok };
}
