const DEFAULT_COUNTRY = "PH";

function getClientIp(request: Request): string | null {
  // Cloudflare-fronted hosts set this after stripping client-supplied values,
  // so prefer it when present — harder to spoof than XFF.
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const xri = request.headers.get("x-real-ip");
  return xri?.trim() || null;
}

function isPrivateOrLocalIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

/**
 * Best-effort country detection used only to route between payment
 * providers (PayMongo vs Stripe) — a UX decision, not an auth boundary, so a
 * spoofed header or VPN just lands the user on the "other" provider, never a
 * security bypass. Always resolves; never throws. Defaults to PH on any
 * ambiguity or error, which preserves today's PayMongo-only behavior.
 */
export async function getCountryCode(request: Request): Promise<string> {
  const vercelCountry = request.headers.get("x-vercel-ip-country");
  if (vercelCountry) return vercelCountry.toUpperCase();

  const ip = getClientIp(request);
  if (!ip || isPrivateOrLocalIp(ip)) return DEFAULT_COUNTRY;

  try {
    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code`,
      { signal: AbortSignal.timeout(1500) }
    );
    if (!res.ok) return DEFAULT_COUNTRY;
    const data = await res.json();
    if (data?.success === false) return DEFAULT_COUNTRY;
    const code =
      typeof data?.country_code === "string"
        ? data.country_code.toUpperCase()
        : null;
    return code || DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
}
