import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Layout/Sidebar";
import MobileNav from "@/components/Layout/MobileNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crypto Portfolio Tracker",
  description: "Premium Crypto Analytics & Trading Journal",
};

import { Providers } from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <Providers>
          <Sidebar className="hidden md:flex fixed left-0 top-0" />
          <MobileNav />
          <main className="pl-0 md:pl-64 transition-all duration-300">
            <div className="flex min-h-screen flex-col p-4 md:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
