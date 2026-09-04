import { createHmac, timingSafeEqual } from "node:crypto";

// Reject signatures older than this even if the HMAC is valid, so a
// captured request/signature pair can't be replayed indefinitely.
const MAX_SIGNATURE_AGE_SECONDS = 5 * 60;

/**
 * Verifies a PayMongo webhook's `Paymongo-Signature` header, formatted as
 * `t=<timestamp>,te=<test-mode-signature>,li=<live-mode-signature>`.
 * The expected signature is HMAC-SHA256(secret, `${timestamp}.${rawBody}`),
 * hex-encoded. `rawBody` must be the exact, unparsed request body — PayMongo
 * signs the raw bytes, so parsing (or reformatting) it first breaks the check.
 */
export function verifyPaymongoSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;

  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const [key, value] = segment.split("=");
    if (key && value) parts[key] = value;
  }

  const timestamp = parts.t;
  // Live signature takes precedence when both are present, matching
  // PayMongo's own SDK behavior.
  const expectedSignature = parts.li || parts.te;
  if (!timestamp || !expectedSignature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > MAX_SIGNATURE_AGE_SECONDS) return false;

  const computedSignature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const computedBuffer = Buffer.from(computedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  if (computedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(computedBuffer, expectedBuffer);
}
