import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Urbanist } from "next/font/google"; // Added Urbanist
import "./globals.css";
import Sidebar from "@/components/Layout/Sidebar";
import MobileNav from "@/components/Layout/MobileNav";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist" }); // Configure Urbanist

export const metadata: Metadata = {
  title: "Crypto Portfolio Tracker",
  description: "Premium Crypto Analytics & Trading Journal",
};

import { Providers } from "./providers";

import { ErrorSuppressor } from "@/components/ErrorSuppressor";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${urbanist.className} ${urbanist.variable} ${jetbrainsMono.variable} font-sans antialiased min-h-screen bg-background text-foreground`}
      >
        <ErrorSuppressor />
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
