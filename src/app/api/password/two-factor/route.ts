import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { linkOAuthAccount, OAUTH_TICKET_COOKIE } from "@/lib/oauth-gate";
import { startSession } from "@/lib/password-session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { redeemLoginTicket } from "@/lib/two-factor";

/** Second log-in step: POST { ticket, code } with an authenticator or backup code. */
export async function POST(request: Request) {
  const limit = await rateLimit(`2fa:login:${clientIp(request)}`, 20, 15 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and log in again." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  // After Google/Facebook the ticket is in a cookie (src/lib/oauth-gate.ts).
  const fromCookie = (await cookies()).get(OAUTH_TICKET_COOKIE)?.value ?? "";
  const ticket = typeof body?.ticket === "string" && body.ticket ? body.ticket : fromCookie;
  const code = typeof body?.code === "string" ? body.code.slice(0, 20) : "";
  if (!code.trim()) {
    return NextResponse.json({ error: "Enter the code from your authenticator app." }, { status: 400 });
  }

  const result = await redeemLoginTicket(ticket, code);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  if (result.link) await linkOAuthAccount(result.userId, result.link);
  const response = NextResponse.json({ ok: true });
  if (fromCookie) response.cookies.delete(OAUTH_TICKET_COOKIE);
  return startSession(response, request, result.userId);
}
