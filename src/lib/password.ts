import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

// scrypt with OWASP's minimum cost (N=2^17, r=8, p=1): about 128 MB and
// ~100 ms per hash. Stored as scrypt$N$r$p$salt$hash so the cost can rise
// later without breaking old hashes.
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 256 * 1024 * 1024;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** A reason the password isn't acceptable, or null. */
export function passwordProblem(password: string) {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  return null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A fixed hash to check against when the email has no password, so a wrong
// email takes as long as a wrong password (no account discovery by timing).
let dummy: Promise<string> | null = null;
export function dummyHash() {
  dummy ??= hashPassword(randomBytes(16).toString("hex"));
  return dummy;
}
