import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Privacy Policy — ${LEGAL.productName}`,
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated: {LEGAL.lastUpdated}</p>

      <p>
        This Privacy Policy explains how {LEGAL.companyName} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects, uses, shares and protects your personal
        information when you use {LEGAL.productName} (the &ldquo;Service&rdquo;).
        We process personal information in line with the Philippine Data
        Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and
        Regulations, and issuances of the National Privacy Commission (NPC).
      </p>

      <h2>1. Who is responsible for your data</h2>
      <p>
        {LEGAL.companyName}, {LEGAL.companyAddress}, is the personal information
        controller for the Service. Our Data Protection Officer is{" "}
        {LEGAL.dpoName}, who can be reached at{" "}
        <a href={`mailto:${LEGAL.dpoEmail}`}>{LEGAL.dpoEmail}</a>.
      </p>

      <h2>2. What we collect</h2>
      <h3>Account information</h3>
      <p>
        You sign in with Google or Facebook. From that provider we receive your
        name, email address, profile photo and an account identifier. We never
        receive your Google or Facebook password.
      </p>
      <h3>Content you create</h3>
      <ul>
        <li>Messages you type to the assistant and the replies it generates.</li>
        <li>
          Voice input: when you use voice mode, your recording is sent to our AI
          provider to be converted to text. We keep the resulting text as a
          chat message; we do not store the audio recording itself.
        </li>
        <li>Conversation titles, pinned chats and Journeys you save.</li>
        <li>
          Organization details: organization names, members and their roles,
          and the email addresses of people you invite.
        </li>
        <li>Messages you send to our support team.</li>
      </ul>
      <h3>Payment information</h3>
      <p>
        When you buy a plan, we record the plan, amount, currency, payment
        status and the reference number issued by our payment provider. Your
        card, GCash or Maya details are entered on the payment provider&rsquo;s
        own page and are never sent to or stored by us.
      </p>
      <h3>Usage and technical information</h3>
      <ul>
        <li>
          How many messages you send each day and the AI model used, so we can
          apply your plan&rsquo;s limits.
        </li>
        <li>
          A session cookie that keeps you signed in, and your theme preference
          stored in your browser. See our{" "}
          <Link href="/cookies">Cookie Policy</Link>.
        </li>
        <li>
          Your IP address, which our servers and providers necessarily receive
          when you connect, and which may be used to estimate your country for
          choosing a payment provider.
        </li>
      </ul>
      <p>
        We do not use advertising trackers or third-party analytics, and we do
        not sell your personal information.
      </p>

      <h2>3. Why we use it and our legal basis</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Purpose</th>
              <th scope="col">Legal basis (RA 10173, Sec. 12)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Creating your account, signing you in, running the assistant,
                saving your chats and Journeys, and running organizations
              </td>
              <td>Necessary to provide the Service you signed up for (contract)</td>
            </tr>
            <tr>
              <td>Processing payments and activating plans</td>
              <td>Contract; compliance with tax and accounting laws</td>
            </tr>
            <tr>
              <td>
                Rate limiting, fraud prevention, and keeping the Service secure
              </td>
              <td>Our legitimate interest in protecting the Service and its users</td>
            </tr>
            <tr>
              <td>Answering support requests</td>
              <td>Contract; your request</td>
            </tr>
            <tr>
              <td>
                Sending your content to our AI provider outside the Philippines
                (see section 4)
              </td>
              <td>Contract, and the consent you give when you sign in</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        We do not use your conversations to train AI models, and we do not
        process sensitive personal information on purpose. Please avoid sharing
        health, government ID, financial account or other sensitive details in
        your chats.
      </p>

      <h2>4. Who we share it with</h2>
      <p>
        We share personal information only with service providers that help us
        run the Service, under agreements that require them to protect it:
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Provider</th>
              <th scope="col">What they do</th>
              <th scope="col">Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>OpenAI</td>
              <td>
                Generates assistant replies, converts voice to text and text to
                speech. Receives your messages, chat history and voice
                recordings.
              </td>
              <td>United States</td>
            </tr>
            <tr>
              <td>Google, Meta (Facebook)</td>
              <td>Sign-in</td>
              <td>United States / global</td>
            </tr>
            <tr>
              <td>PayMongo</td>
              <td>Payment processing</td>
              <td>Philippines</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>Payment processing for international customers, when offered</td>
              <td>United States</td>
            </tr>
            <tr>
              <td>Supabase</td>
              <td>Database hosting</td>
              <td>Cloud (outside the Philippines)</td>
            </tr>
            <tr>
              <td>Upstash</td>
              <td>Rate limiting (stores account IDs and request counts)</td>
              <td>Cloud (outside the Philippines)</td>
            </tr>
            <tr>
              <td>Our hosting provider</td>
              <td>Runs the website and servers</td>
              <td>Cloud (outside the Philippines)</td>
            </tr>
            <tr>
              <td>ipwho.is</td>
              <td>
                Estimates your country from your IP address, when we need it to
                choose a payment provider
              </td>
              <td>Cloud (outside the Philippines)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Because several providers are located abroad, your information is
        transferred outside the Philippines. We remain responsible for it and
        choose providers that apply security safeguards comparable to those
        required by Philippine law. Our support staff can view your account
        details and support messages to help you, and access to your chats is
        limited to what is needed to investigate a problem you report or to
        comply with the law. Members of an organization you join can see
        your name, email address and role in that organization. We may also
        disclose information when required by law, a court order, or to protect
        the rights and safety of our users or the public.
      </p>

      <h2>5. How long we keep it</h2>
      <ul>
        <li>
          Account, chats, Journeys and organization data: until you delete them
          or close your account. Deleted chats are permanently removed from our
          database.
        </li>
        <li>
          Payment records: for as long as Philippine tax and accounting rules
          require, even after your account is closed.
        </li>
        <li>Rate-limit counters: minutes to hours.</li>
        <li>
          Our AI provider may keep API inputs and outputs for a limited period
          (currently up to 30 days) for abuse monitoring before deleting them.
        </li>
      </ul>

      <h2>6. How we protect it</h2>
      <p>
        We use encrypted connections (HTTPS), store session tokens in hashed
        form, restrict database access by role, rate-limit requests, and verify
        payment notifications cryptographically. If a personal data breach
        occurs that is likely to put you at risk, we will notify you and the
        National Privacy Commission within 72 hours of discovering it, as the
        law requires.
      </p>

      <h2 id="your-rights">7. Your rights</h2>
      <p>Under the Data Privacy Act you have the right to:</p>
      <ul>
        <li>be informed about how your personal information is processed;</li>
        <li>access the personal information we hold about you;</li>
        <li>object to processing, including processing based on consent;</li>
        <li>have inaccurate information corrected;</li>
        <li>have your information erased or blocked;</li>
        <li>receive a copy of your data in a portable electronic format;</li>
        <li>be compensated for damages caused by unlawful processing; and</li>
        <li>
          file a complaint with the National Privacy Commission
          (privacy.gov.ph).
        </li>
      </ul>
      <p>
        You can delete individual chats in the app at any time. To exercise any
        other right, including closing your account and deleting all your data,
        email <a href={`mailto:${LEGAL.dpoEmail}`}>{LEGAL.dpoEmail}</a>. We will
        verify your identity and respond within 30 days.
      </p>

      <h3 id="delete-your-data">Deleting your account and data</h3>
      <ul>
        <li>
          To delete a single conversation, use the delete button next to it
          in the sidebar. It is removed immediately.
        </li>
        <li>
          To delete your whole account, email{" "}
          <a href={`mailto:${LEGAL.dpoEmail}`}>{LEGAL.dpoEmail}</a> from the
          address you sign in with. We delete your profile, chats, Journeys and
          memberships within 30 days, and keep only the payment records the
          law requires us to retain.
        </li>
        <li>
          Deleting your {LEGAL.productName} account does not delete your Google
          or Facebook account. You can also remove {LEGAL.productName}&rsquo;s access
          from your Google or Facebook account settings.
        </li>
      </ul>

      <h2>8. Children and teenagers</h2>
      <p>
        The Service is for people aged 15 and over. Users aged 15 to 17 may
        use it only with the consent of a parent or legal guardian, given when
        they sign in. We do not knowingly collect information from anyone under
        15; if we learn that we have, we delete the account.
      </p>
      <p>
        A parent or guardian of a user under 18 can exercise that user&rsquo;s
        privacy rights on their behalf, including asking to see or delete the
        account, by emailing{" "}
        <a href={`mailto:${LEGAL.dpoEmail}`}>{LEGAL.dpoEmail}</a>. The
        assistant is instructed to avoid mature topics when a user indicates
        they are under 18.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We will post any changes on this page and update the date above. If a
        change materially affects how we use your information, we will notify
        you in the app or by email before it takes effect.
      </p>

      <h2>10. Contact us</h2>
      <p>
        {LEGAL.companyName}
        <br />
        {LEGAL.companyAddress}
        <br />
        Data Protection Officer: {LEGAL.dpoName},{" "}
        <a href={`mailto:${LEGAL.dpoEmail}`}>{LEGAL.dpoEmail}</a>
      </p>
    </>
  );
}
