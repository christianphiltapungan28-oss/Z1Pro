import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Cookie Policy — ${LEGAL.productName}`,
};

const COOKIES = [
  {
    name: "authjs.session-token",
    purpose: "Keeps you signed in",
    duration: "30 days, renewed as you use the Service",
  },
  {
    name: "authjs.csrf-token",
    purpose: "Protects sign-in and sign-out requests from forgery",
    duration: "Until you close your browser",
  },
  {
    name: "authjs.callback-url",
    purpose: "Returns you to the right page after signing in",
    duration: "Until you close your browser",
  },
  {
    name: "authjs.state, authjs.pkce.code_verifier, authjs.nonce",
    purpose: "Secures the Google or Facebook sign-in handshake",
    duration: "15 minutes",
  },
];

export default function CookiesPage() {
  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="updated">Last updated: {LEGAL.lastUpdated}</p>

      <p>
        This policy explains the cookies and similar browser storage that{" "}
        {LEGAL.productName} uses. Cookies are small text files a website stores
        in your browser.
      </p>

      <h2>The short version</h2>
      <p>
        We only use cookies and storage that the Service needs to work or that
        remember a choice you made. We do not use advertising, analytics,
        tracking or social media cookies, and we do not embed third-party
        content that sets its own cookies. Because of this, we do not show a
        cookie consent banner: strictly necessary storage does not require
        consent.
      </p>

      <h2>Cookies we set</h2>
      <p>
        All of these are first-party, strictly necessary cookies. In production
        their names start with <code>__Secure-</code> or <code>__Host-</code>,
        which means browsers only send them over HTTPS.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Purpose</th>
              <th scope="col">Duration</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map((cookie) => (
              <tr key={cookie.name}>
                <td>
                  <code>{cookie.name}</code>
                </td>
                <td>{cookie.purpose}</td>
                <td>{cookie.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Browser storage</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Purpose</th>
              <th scope="col">Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>theme</code> (localStorage)
              </td>
              <td>Remembers the appearance you picked in Settings</td>
              <td>Until you clear your browser data</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Third-party sites</h2>
      <p>
        When you sign in, you are sent to Google or Facebook, and when you pay,
        you are sent to our payment provider. Those sites set their own cookies
        under their own policies. Your profile photo is loaded from Google or
        Facebook&rsquo;s servers.
      </p>

      <h2>Managing cookies</h2>
      <p>
        You can block or delete cookies in your browser settings. If you block
        the cookies above, you will not be able to sign in.
      </p>

      <h2>Changes</h2>
      <p>
        If we ever add analytics or other non-essential cookies, we will update
        this policy and ask for your consent before setting them.
      </p>

      <p>
        Questions? See our <Link href="/privacy">Privacy Policy</Link> or email{" "}
        <a href={`mailto:${LEGAL.dpoEmail}`}>{LEGAL.dpoEmail}</a>.
      </p>
    </>
  );
}
