import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Refund Policy — ${LEGAL.productName}`,
};

export default function RefundsPage() {
  return (
    <>
      <h1>Refund Policy</h1>
      <p className="updated">Last updated: {LEGAL.lastUpdated}</p>

      <p>
        This policy explains when you can get your money back for a paid{" "}
        {LEGAL.productName} plan. It forms part of our{" "}
        <Link href="/terms">Terms and Conditions</Link> and does not limit any
        rights you have under the Consumer Act of the Philippines (Republic Act
        No. 7394) or other applicable law.
      </p>

      <h2>1. How plans are billed</h2>
      <p>
        Each payment buys one billing period (a month or a year, as shown at
        checkout). Plans do not renew automatically, so you will never be
        charged again unless you choose to buy another period. There is nothing
        to cancel.
      </p>

      <h2>2. When we give a full refund</h2>
      <ul>
        <li>
          <strong>7-day guarantee:</strong> if you are not satisfied, ask for a
          refund within 7 days of your payment and we will refund it in full.
          This applies once per customer or organization.
        </li>
        <li>
          <strong>Billing errors:</strong> you were charged twice, charged the
          wrong amount, or charged for a plan you did not choose.
        </li>
        <li>
          <strong>Plan not activated:</strong> your payment went through but
          your plan was not activated and we could not fix it within 3 business
          days of you telling us.
        </li>
        <li>
          <strong>Purchase by a minor:</strong> a user under 18 bought a plan
          without their parent or guardian&rsquo;s permission, and the parent
          or guardian asks us within 30 days of the payment.
        </li>
        <li>
          <strong>Service not delivered:</strong> the Service was unavailable
          for a significant part of your paid period because of a problem on
          our side, or we discontinued a paid plan. In these cases we refund
          the unused portion of your period.
        </li>
      </ul>

      <h2>3. When we don&rsquo;t give a refund</h2>
      <ul>
        <li>Requests made more than 7 days after payment, except as listed above.</li>
        <li>Partial periods you chose not to use.</li>
        <li>
          Accounts suspended or closed for breaking our Terms and Conditions.
        </li>
      </ul>

      <h2>4. How to ask for a refund</h2>
      <p>
        Email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>{" "}
        from the email address on your account, with the date of payment and
        the payment reference from your receipt. We will reply within 3
        business days.
      </p>

      <h2>5. How refunds are paid</h2>
      <p>
        Approved refunds go back to the original payment method (card, GCash or
        Maya) through our payment provider. Your plan ends when the refund is
        issued. Depending on your bank or e-wallet, the money usually appears
        within 5 to 10 business days. We do not charge a fee for refunds.
      </p>

      <h2>6. Chargebacks</h2>
      <p>
        Please contact us before disputing a charge with your bank. We can
        usually resolve problems faster, and disputes that turn out to be
        unfounded may lead us to suspend the account.
      </p>
    </>
  );
}
