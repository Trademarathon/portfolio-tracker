"use client";

import Link from "next/link";
import Image from "next/image";
import React from "react";
import { ArrowRight, Menu, X, Home, ChartColumn, CircleDollarSign, Wallet } from "lucide-react";
import { NavBar } from "@/components/ui/tubelight-navbar";

interface TemplateButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "gradient";
  size?: "default" | "sm" | "lg";
  children: React.ReactNode;
}

const TemplateButton = React.forwardRef<HTMLButtonElement, TemplateButtonProps>(
  ({ variant = "default", size = "default", className = "", children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variants = {
      default: "bg-white text-black hover:bg-gray-100",
      secondary: "bg-gray-800 text-white hover:bg-gray-700",
      ghost: "hover:bg-gray-800/50 text-white",
      gradient:
        "bg-gradient-to-b from-white via-white/95 to-white/60 text-black hover:scale-105 active:scale-95",
    };

    const sizes = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-10 px-5 text-sm",
      lg: "h-12 px-8 text-base",
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

TemplateButton.displayName = "TemplateButton";

const Navigation = React.memo(() => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-gray-800/50 bg-black/80 backdrop-blur-md">
      <nav className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold text-white">Trade Marathon</div>

          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-8 md:flex">
            <a href="#getting-started" className="text-sm text-white/60 transition-colors hover:text-white">
              Getting started
            </a>
            <a href="#components" className="text-sm text-white/60 transition-colors hover:text-white">
              Components
            </a>
            <a href="#documentation" className="text-sm text-white/60 transition-colors hover:text-white">
              Documentation
            </a>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <Link href="/login">
              <TemplateButton type="button" variant="ghost" size="sm">
                Sign in
              </TemplateButton>
            </Link>
            <Link href="/markets">
              <TemplateButton type="button" variant="default" size="sm">
                Open Terminal
              </TemplateButton>
            </Link>
          </div>

          <button
            type="button"
            className="text-white md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="animate-saas-slide-down border-t border-gray-800/50 bg-black/95 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-4 px-6 py-4">
            <a
              href="#getting-started"
              className="py-2 text-sm text-white/60 transition-colors hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              Getting started
            </a>
            <a
              href="#components"
              className="py-2 text-sm text-white/60 transition-colors hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              Components
            </a>
            <a
              href="#documentation"
              className="py-2 text-sm text-white/60 transition-colors hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              Documentation
            </a>
            <div className="flex flex-col gap-2 border-t border-gray-800/50 pt-4">
              <Link href="/login">
                <TemplateButton type="button" variant="ghost" size="sm" className="w-full">
                  Sign in
                </TemplateButton>
              </Link>
              <Link href="/markets">
                <TemplateButton type="button" variant="default" size="sm" className="w-full">
                  Open Terminal
                </TemplateButton>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});

Navigation.displayName = "Navigation";

const Hero = React.memo(() => {
  return (
    <section
      id="getting-started"
      className="animate-saas-fade-in relative flex min-h-screen flex-col items-center justify-start px-6 py-20 md:py-24"
    >
      <aside className="mb-8 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-gray-700 bg-gray-800/50 px-4 py-2 backdrop-blur-sm">
        <span className="whitespace-nowrap text-center text-xs text-gray-400">
          New version of template is out!
        </span>
        <a
          href="#new-version"
          className="flex items-center gap-1 whitespace-nowrap text-xs text-gray-400 transition-all hover:text-white active:scale-95"
          aria-label="Read more about the new version"
        >
          Read more
          <ArrowRight size={12} />
        </a>
      </aside>

      <h1
        className="mb-6 max-w-3xl px-6 text-center text-4xl font-medium leading-tight tracking-[-0.05em] md:text-5xl lg:text-6xl"
        style={{
          background: "linear-gradient(to bottom, #ffffff, #ffffff, rgba(255, 255, 255, 0.6))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Give your big idea <br />the website it deserves
      </h1>

      <p className="mb-10 max-w-2xl px-6 text-center text-sm text-gray-400 md:text-base">
        Landing page kit template with React, Shadcn/ui and Tailwind
        <br />
        that you can copy/paste into your project.
      </p>

      <div className="relative z-10 mb-16 flex items-center gap-4">
        <Link href="/markets">
          <TemplateButton
            type="button"
            variant="gradient"
            size="lg"
            className="rounded-lg"
            aria-label="Open trading terminal"
          >
            Open Terminal
          </TemplateButton>
        </Link>
      </div>

      <div className="relative w-full max-w-5xl pb-20">
        <div
          className="pointer-events-none absolute left-1/2 z-0 w-[90%] -translate-x-1/2"
          style={{ top: "-23%" }}
          aria-hidden="true"
        >
          <Image
            src="/images/landing/hero-glow.jpg"
            alt=""
            width={1600}
            height={800}
            className="h-auto w-full"
            priority
          />
        </div>

        <div id="components" className="relative z-10">
          <Image
            src="/images/landing/hero-dashboard.jpg"
            alt="Dashboard preview showing analytics and metrics interface"
            width={1600}
            height={1000}
            className="h-auto w-full rounded-lg shadow-2xl"
            priority
          />
        </div>
      </div>

      <div id="documentation" className="sr-only">
        Documentation
      </div>
    </section>
  );
});

Hero.displayName = "Hero";

export default function SaasTemplate() {
  const navItems = [
    { name: "Home", url: "/", icon: Home },
    { name: "Markets", url: "/markets", icon: ChartColumn },
    { name: "Balances", url: "/balances", icon: Wallet },
    { name: "Activity", url: "/activity", icon: CircleDollarSign },
  ];

  return (
    <main className="min-h-screen bg-black font-[Poppins,sans-serif] text-white">
      <Navigation />
      <Hero />
      <NavBar items={navItems} className="bottom-5 sm:bottom-5 sm:top-auto" />
    </main>
  );
}
