import { createHash } from "node:crypto";
import { cookies } from "next/headers";

// Auth.js prefixes the cookie with __Secure- on HTTPS.
const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

/** Hash of this request's session token, matching sessions.token_hash. */
export async function currentSessionHash() {
  const jar = await cookies();
  for (const name of SESSION_COOKIES) {
    const token = jar.get(name)?.value;
    if (token) return createHash("sha256").update(token).digest("hex");
  }
  return null;
}
