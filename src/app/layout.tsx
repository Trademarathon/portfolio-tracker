import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SidebarLayout from "@/components/Layout/SidebarLayout";

// Primary font - Clean, modern, highly legible
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: 'swap',
});

// Monospace font - For numbers, code, prices
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Trade Marathon®",
  description: "Premium Crypto Analytics & Trading Journal",
  icons: { icon: "/trade-marathon-logo.png" },
};

import { Providers } from "./providers";

import { ErrorSuppressor } from "@/components/ErrorSuppressor";
import { KeyedChildren } from "@/components/Layout/KeyedChildren";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html key="root-html" lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} ${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <div key="root-layout-wrapper">
          <ErrorSuppressor key="error-suppressor" />
          <Providers key="app-providers">
            <SidebarLayout key="sidebar-layout">
              <KeyedChildren key="keyed-children">{children}</KeyedChildren>
            </SidebarLayout>
          </Providers>
        </div>
      </body>
    </html>
  );
}
