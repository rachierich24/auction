import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";

import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Groovy Auction — Bid. Win. Own.",
    template: "%s · Groovy Auction",
  },
  description:
    "A curated saleroom for collectors of horology, fine art, automobiles and rare objects. Live, server-timed bidding with a complete public bid ledger.",
  applicationName: "Groovy Auction",
  keywords: [
    "auction",
    "live auction",
    "collectors",
    "fine art auction",
    "watch auction",
    "classic car auction",
  ],
  openGraph: {
    type: "website",
    siteName: "Groovy Auction",
    title: "Groovy Auction — Bid. Win. Own.",
    description:
      "A curated saleroom for collectors. Live, server-timed bidding with a complete public bid ledger.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Groovy Auction — Bid. Win. Own.",
    description:
      "A curated saleroom for collectors. Live, server-timed bidding with a complete public bid ledger.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f7f6f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
