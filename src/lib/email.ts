/** True once RESEND_API_KEY and EMAIL_FROM are set (see .env.example). */
export function emailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A plain, single-button email in Z1P's colours. */
function layout(opts: { heading: string; body: string; button?: { label: string; url: string }; footer?: string }) {
  const button = opts.button
    ? `<p style="margin:28px 0"><a href="${escapeHtml(opts.button.url)}" style="background:#ff1da5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${escapeHtml(opts.button.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#17171b">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:22px;font-weight:800;color:#ff1da5;margin:0 0 24px">Z1P</p>
<div style="background:#fff;border:1px solid #e2e5ea;border-radius:16px;padding:28px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(opts.heading)}</h1>
${opts.body
  .split(/\n\s*\n/)
  .map((para) => `<p style="font-size:15px;line-height:1.5;color:#3c4043;margin:0 0 12px">${escapeHtml(para.trim()).replace(/\n/g, "<br>")}</p>`)
  .join("\n")}
${button}
</div>
<p style="font-size:12px;color:#8a8a8a;line-height:1.5;margin:20px 4px 0">${escapeHtml(
    opts.footer ?? "You get this because email notifications are on in Z1P Settings → Notifications."
  )}</p>
</div></body></html>`;
}

/** Sends one email through Resend. Returns false (and logs) on failure. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  button?: { label: string; url: string };
  footer?: string;
  /** Marketing emails: footer link plus List-Unsubscribe headers (RFC 8058). */
  unsubscribeUrl?: string;
}) {
  if (!emailConfigured()) return false;
  const unsubscribe = opts.unsubscribeUrl
    ? `<p style="font-size:12px;color:#8a8a8a;margin:8px 4px 0"><a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#8a8a8a">Unsubscribe from tips and product updates</a></p>`
    : "";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: layout(opts).replace("</div></body></html>", `${unsubscribe}</div></body></html>`),
        text: `${opts.heading}\n\n${opts.body}${opts.button ? `\n\n${opts.button.label}: ${opts.button.url}` : ""}${
          opts.unsubscribeUrl ? `\n\nUnsubscribe: ${opts.unsubscribeUrl}` : ""
        }`,
        ...(opts.unsubscribeUrl
          ? {
              headers: {
                "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error("Resend email failed", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("Resend email failed", err);
    return false;
  }
}

/** Absolute link into the app, for emails (APP_URL, e.g. https://z1p.pro). */
export function emailLink(path: string) {
  return new URL(path, process.env.APP_URL || "http://localhost:3000").toString();
}
