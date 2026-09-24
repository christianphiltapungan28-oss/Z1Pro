import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Terms and Conditions — ${LEGAL.productName}`,
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms and Conditions</h1>
      <p className="updated">Last updated: {LEGAL.lastUpdated}</p>

      <p>
        These Terms and Conditions (&ldquo;Terms&rdquo;) are an agreement
        between you and {LEGAL.companyName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
        for your use of {LEGAL.productName} (the &ldquo;Service&rdquo;). By
        signing in or using the Service, you agree to these Terms and to our{" "}
        <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do not
        use the Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        {LEGAL.productName} is an AI assistant you can talk to by text or voice.
        It lets you save conversations, track goals as Journeys, and work
        together in organizations. We may change, add or remove features over
        time.
      </p>

      <h2>2. Eligibility and your account</h2>
      <ul>
        <li>You must be at least 15 years old to use the Service.</li>
        <li>
          If you are 15 to 17, your parent or legal guardian must read and
          agree to these Terms and the Privacy Policy before you sign in. By
          agreeing, they accept these Terms on your behalf and are responsible
          for your use of the Service, including any purchases.
        </li>
        <li>
          Users under 18 may buy a paid plan only with their parent or
          guardian&rsquo;s permission. A parent or guardian can ask us to
          refund a purchase made without it (see the{" "}
          <Link href="/refunds">Refund Policy</Link>).
        </li>
        <li>
          You sign in with a Google or Facebook account. You are responsible
          for keeping that account secure and for everything done through your{" "}
          {LEGAL.productName} account.
        </li>
        <li>Tell us promptly if you believe your account has been misused.</li>
      </ul>

      <h2>3. Organizations</h2>
      <p>
        When you create an organization you become its owner. Owners and
        admins can invite and remove members and manage the organization&rsquo;s
        plan. By inviting someone, you confirm you have a legitimate reason to
        share their email address with us. Paid plans apply to the
        organization, and owners and admins are responsible for payments made
        for it.
      </p>

      <h2>4. AI-generated content</h2>
      <ul>
        <li>
          Replies are generated automatically by AI models and may be
          inaccurate, incomplete, outdated or offensive. Check important
          information yourself.
        </li>
        <li>
          The Service does not give professional advice. Do not rely on it for
          medical, legal, financial, tax or safety decisions; consult a
          qualified professional.
        </li>
        <li>
          To produce replies, your messages and voice recordings are processed
          by our AI provider, as described in the Privacy Policy.
        </li>
      </ul>

      <h2>5. Your content</h2>
      <p>
        You keep ownership of what you type or say to the Service and, as
        between you and us, of the replies generated for you. You give us a
        limited licence to store, process and transmit your content only as
        needed to run the Service for you. You are responsible for making sure
        you have the right to share any content you submit.
      </p>

      <h2>6. Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>break any law, or help anyone else break one;</li>
        <li>
          harass, threaten, defame or impersonate others, or share their
          personal information without permission;
        </li>
        <li>
          create content that sexually exploits minors, promotes violence or
          terrorism, or facilitates fraud;
        </li>
        <li>
          generate malware, attempt to gain unauthorised access to systems, or
          disrupt the Service;
        </li>
        <li>
          get around usage limits, scrape the Service, or resell it without our
          written permission; or
        </li>
        <li>
          infringe anyone&rsquo;s intellectual property or other rights.
        </li>
      </ul>
      <p>
        We may suspend or close accounts that break these rules and report
        illegal activity to the authorities. As required by the Anti-Online
        Sexual Abuse or Exploitation of Children Act (RA 11930), we report any
        child sexual abuse or exploitation material to law enforcement.
      </p>

      <h2>7. Plans and payments</h2>
      <ul>
        <li>
          The free plan includes a daily message limit. Paid plans raise or
          remove that limit and may use more capable AI models, as described on
          the plan page when you buy.
        </li>
        <li>
          Prices are shown before you pay, in Philippine pesos unless stated
          otherwise, and include any applicable taxes unless stated otherwise.
          Payments are processed by PayMongo (and, where offered, Stripe); we
          never see your full card or wallet details.
        </li>
        <li>
          Each payment buys one billing period (a month or a year, as shown).
          Plans <strong>do not renew automatically</strong>: when the period
          ends, your organization returns to the free plan unless you buy
          again.
        </li>
        <li>
          We may change prices for future periods. A change never affects a
          period you have already paid for.
        </li>
        <li>
          Refunds are covered by our <Link href="/refunds">Refund Policy</Link>.
        </li>
      </ul>

      <h2>8. Ending your use</h2>
      <p>
        You can stop using the Service at any time and ask us to delete your
        account by emailing{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. We
        may suspend or end your access if you seriously or repeatedly break
        these Terms, if required by law, or if we discontinue the Service; if
        we discontinue a paid plan for reasons other than your breach, we will
        refund the unused part of your current period.
      </p>

      <h2>9. Availability and disclaimers</h2>
      <p>
        We work to keep the Service available and reliable, but it is provided
        &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the
        law allows, we do not promise that it will be uninterrupted, error-free
        or fit for a particular purpose. Nothing in these Terms limits the
        rights you have as a consumer under the Consumer Act of the Philippines
        (Republic Act No. 7394) or other laws that cannot be waived.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect,
        incidental or consequential losses, lost profits or lost data, or for
        decisions you make based on AI-generated content. Our total liability
        for any claim relating to the Service is limited to the amount you paid
        us in the 12 months before the claim. These limits do not apply to
        liability that cannot legally be limited, such as liability for fraud,
        gross negligence or wilful misconduct.
      </p>

      <h2>11. Indemnity</h2>
      <p>
        You agree to compensate us for claims and costs arising from your
        breach of these Terms or your unlawful use of the Service.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms. We will post the new version here and update
        the date above; for material changes we will notify you in the app or
        by email before they take effect. If you keep using the Service after
        that, the new Terms apply.
      </p>

      <h2>13. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of {LEGAL.governingLaw}. Before
        going to court, please contact us so we can try to resolve the issue
        informally. Any dispute that cannot be resolved will be brought before
        the proper courts of the Philippines.
      </p>

      <h2>14. Contact</h2>
      <p>
        {LEGAL.companyName} ({LEGAL.businessRegistration})
        <br />
        {LEGAL.companyAddress}
        <br />
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
      </p>
    </>
  );
}
