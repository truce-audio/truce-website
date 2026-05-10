import type { Metadata } from "next";
import { framework } from "@/content/framework";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${framework.domain}`),
  title: {
    default: `${framework.domain} — ${framework.tagline}`,
    template: `%s · ${framework.domain}`,
  },
  description: framework.description,
  openGraph: {
    title: `${framework.domain} — ${framework.tagline}`,
    description: framework.description,
    url: `https://${framework.domain}`,
    siteName: framework.domain,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${framework.domain} — ${framework.tagline}`,
    description: framework.description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body className="font-sans min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
