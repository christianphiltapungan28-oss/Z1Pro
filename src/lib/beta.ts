/*
 * Private beta. BETA_ALLOWLIST lists who may sign in: email addresses and/or
 * whole domains written as "@example.com", separated by commas, spaces or new
 * lines. Anyone else is turned away at sign-in, so they can't create an
 * account or use AI credit. Unset or empty means Z1P is open to everyone
 * (local development, and launch).
 */

function allowlist() {
  return (process.env.BETA_ALLOWLIST ?? "")
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function betaAllows(email: string | null | undefined) {
  const list = allowlist();
  if (list.length === 0) return true;
  const address = (email ?? "").trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at < 1) return false;
  return list.includes(address) || list.includes(address.slice(at));
}

export const NOT_INVITED =
  "Z1P is in private beta, and this email isn't on the invite list yet. Ask the Z1P team for an invite.";
