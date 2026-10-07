import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010"),
  title: {
    default: "Shiggy Trails",
    template: "%s · Shiggy Trails",
  },
  description:
    "A digital home for the worldwide Hash House Harriers community: find kennels, join runs, and preserve every trail.",
  // The home page and any page that sets no preview of its own. A page that does
  // set one goes through lib/share-metadata.ts, which carries the same site name.
  openGraph: {
    siteName: "Shiggy Trails",
    title: "Shiggy Trails",
    description:
      "A digital home for the worldwide Hash House Harriers community: find kennels, join runs, and preserve every trail.",
    type: "website",
  },
  twitter: { card: "summary", title: "Shiggy Trails" },
};

// viewport-fit=cover so the fixed top and bottom bars can pad for the notch and home indicator.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1a16" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          {/* Carries the bottom padding that clears the phone tab bar */}
          <Footer />
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
