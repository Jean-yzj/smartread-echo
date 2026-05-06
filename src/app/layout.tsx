import type { Metadata } from "next";
import { Manrope, Noto_Serif_TC } from "next/font/google";
import "./globals.css";

const bodyFont = Manrope({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const displayFont = Noto_Serif_TC({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "SmartRead Echo",
  description: "A one-day MVP for turning reading highlights into lasting memory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
