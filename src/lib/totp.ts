import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Time-based one-time passwords (RFC 6238): 6 digits, 30-second steps,
// HMAC-SHA1 — what Google Authenticator, Microsoft Authenticator, 1Password
// and the rest expect.

const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text: string) {
  const clean = text.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random secret (160 bits), base32 as authenticator apps expect. */
export function newTotpSecret() {
  return base32Encode(randomBytes(20));
}

function codeAt(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Checks a code against the current step and one either side (clock drift).
 * Returns the matching step, so callers can refuse the same code twice, or
 * null.
 */
export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const given = Buffer.from(code.replace(/\s/g, ""));
  if (!/^\d{6}$/.test(given.toString())) return null;
  const current = Math.floor(now / 1000 / STEP_SECONDS);
  for (const step of [current, current - 1, current + 1]) {
    const expected = Buffer.from(codeAt(secret, step));
    if (timingSafeEqual(given, expected)) return step;
  }
  return null;
}

/** The otpauth:// link authenticator apps read from the QR code. */
export function totpUri(secret: string, account: string) {
  const issuer = "Z1P";
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** For tests: the code for a given time. */
export function totpCodeAt(secret: string, now: number) {
  return codeAt(secret, Math.floor(now / 1000 / STEP_SECONDS));
}
