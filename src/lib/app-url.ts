/**
 * Canonical origin for building redirect URLs handed to third parties
 * (e.g. PayMongo success/cancel URLs). Prefers APP_URL so redirects can't
 * be steered by a spoofed Host header; falls back to the request's own
 * origin if APP_URL isn't configured yet.
 */
export function getAppOrigin(request: Request): string {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}
