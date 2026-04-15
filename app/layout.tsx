import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GoalNowX — Live Football",
  description: "Subscribe to exclusive live football matches and highlights.",
  icons: {
    icon: "/app-icon.png",
    apple: "/app-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/app-icon.png" />
        <link rel="apple-touch-icon" href="/app-icon.png" />
        {/* Same file is linked from standalone /api/otp-page HTML (must stay in /public). */}
        {/* eslint-disable-next-line @next/next/no-css-tags -- public asset; not bundled as module */}
        <link rel="stylesheet" href="/football-collage-backdrop.css" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
