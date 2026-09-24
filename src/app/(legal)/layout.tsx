import Link from "next/link";
import { LEGAL } from "@/lib/legal";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/refunds", label: "Refund Policy" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <header className="border-b border-card-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" className="h-7 w-auto" />
            <span className="font-display text-sm font-semibold">
              Back to {LEGAL.productName}
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <article className="legal-prose">{children}</article>
      </main>

      <footer className="border-t border-card-border">
        <nav
          aria-label="Legal"
          className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-2 px-4 py-6 text-sm sm:px-6"
        >
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mx-auto max-w-3xl px-4 pb-8 text-xs leading-relaxed text-muted sm:px-6">
          {LEGAL.productName} is operated by {LEGAL.companyName}{" "}
          ({LEGAL.businessRegistration}), {LEGAL.companyAddress}. Contact:{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="underline">
            {LEGAL.contactEmail}
          </a>
        </p>
      </footer>
    </div>
  );
}
