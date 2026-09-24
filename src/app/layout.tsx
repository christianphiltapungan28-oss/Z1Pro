import type { Metadata, Viewport } from "next";
import { Google_Sans_Flex, Parkinsans } from "next/font/google";
import { headers } from "next/headers";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

// Google Sans Flex is the design's typeface for all UI text; Parkinsans is
// only used for the Z1P wordmark.
const googleSansFlex = Google_Sans_Flex({
  variable: "--font-google-sans-flex",
  subsets: ["latin"],
});

const parkinsans = Parkinsans({
  variable: "--font-parkinsans",
  subsets: ["latin"],
  weight: ["800"],
});

export const metadata: Metadata = {
  title: "Z1P.pro — Your AI Assistant",
  description: "Speak naturally as Z1P.pro listens and responds instantly.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");document.documentElement.setAttribute("data-theme",t==="aurora"?"aurora":"light")}catch(e){}})()`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${googleSansFlex.variable} ${parkinsans.variable} h-full antialiased`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full font-sans">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
