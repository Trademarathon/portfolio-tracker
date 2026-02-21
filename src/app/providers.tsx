"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";

function useUnhandledRejection() {
    useEffect(() => {
        const onUnhandled = (e: PromiseRejectionEvent) => {
            console.error("[Unhandled Rejection]", e.reason);
            e.preventDefault?.();
            e.stopPropagation?.();
        };
        window.addEventListener("unhandledrejection", onUnhandled);
        return () => window.removeEventListener("unhandledrejection", onUnhandled);
    }, []);
}
import { usePathname, useRouter } from "next/navigation";
import { ThemeProvider } from "@/components/theme-provider";
import { PortfolioProvider } from "@/contexts/PortfolioContext";
import { AlertsProvider } from "@/contexts/AlertsContext";
import { NotificationProvider } from "@/components/Notifications/NotificationSystem";
import { ExchangeProvider } from "@/contexts/ExchangeContext";
import { SupabaseAuthProvider, useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { MovementAlertsSettingsProvider } from "@/contexts/MovementAlertsSettingsContext";
import { LicenseProvider, useLicense } from "@/contexts/LicenseContext";
import { ActivationScreen } from "@/components/License/ActivationScreen";
import { AppearanceSync } from "@/components/AppearanceSync";
import { StorageFullBanner } from "@/components/StorageFullBanner";
import { MarketsBackgroundRunner } from "@/components/Background/MarketsBackgroundRunner";
import { Loader2 } from "lucide-react";
import { SectionErrorBoundary } from "@/components/Dashboard/SectionErrorBoundary";

const LICENSE_GATING_ENABLED = false; // Set to true to re-enable token-based activation
const AUTH_GATING_ENABLED = false; // Temporary: disable login requirement until stability work is complete

function AppGate({ children }: { children: React.ReactNode }) {
    const { isValid, isChecking } = useLicense();

    if (!LICENSE_GATING_ENABLED) {
        return <>{children}</>;
    }

    if (isChecking) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <span className="text-xs text-zinc-500">Checking license...</span>
                </div>
            </div>
        );
    }

    if (!isValid) {
        return <ActivationScreen />;
    }

    return <>{children}</>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isLoading } = useSupabaseAuth();
    const isPublic = pathname === "/login" || pathname.startsWith("/auth/");
    useEffect(() => {
        if (!AUTH_GATING_ENABLED) return;
        if (isLoading) return;
        if (!user && !isPublic) {
            router.replace("/login?next=" + encodeURIComponent(pathname));
        }
    }, [user, isLoading, isPublic, pathname, router]);

    if (!AUTH_GATING_ENABLED) {
        return (
            <div key="auth-gate-wrapper" style={{ display: 'contents' }}>
                <StorageFullBanner key="storage-banner" />
                {children}
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex items-center gap-2 text-zinc-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading…</span>
                </div>
            </div>
        );
    }

    if (!user && !isPublic) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex items-center gap-2 text-zinc-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Redirecting to sign in…</span>
                </div>
            </div>
        );
    }

    return (
        <div key="auth-gate-wrapper" style={{ display: 'contents' }}>
            <StorageFullBanner key="storage-banner" />
            {children}
        </div>
    );
}

function RejectionGuard({ children }: { children: React.ReactNode }) {
    useUnhandledRejection();
    return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 1000 * 30,       // 30s - fresher data, HFT feel
                gcTime: 1000 * 60 * 30,     // 30min - limit RAM, free inactive cache
                refetchOnWindowFocus: true,
                retry: 1,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            <AppearanceSync key="appearance-sync" />
            <ThemeProvider
                key="theme-provider"
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <LicenseProvider>
                    <AppGate>
                        <NotificationProvider>
                            <SupabaseAuthProvider>
                                <AuthGate>
                                    <MovementAlertsSettingsProvider>
                                        <AlertsProvider>
                                            <MarketsBackgroundRunner />
                                            <ExchangeProvider>
                                                <PortfolioProvider>
                                                    <RejectionGuard>
                                                        <SectionErrorBoundary sectionName="app" fallback={
                                                            <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
                                                                <p className="text-sm text-zinc-400 text-center max-w-md">Something went wrong. This can happen after an update or when data is still loading.</p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => window.location.reload()}
                                                                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold uppercase tracking-wider hover:opacity-90"
                                                                >
                                                                    Reload page
                                                                </button>
                                                            </div>
                                                        }>
                                                            {children}
                                                        </SectionErrorBoundary>
                                                    </RejectionGuard>
                                                </PortfolioProvider>
                                            </ExchangeProvider>
                                        </AlertsProvider>
                                    </MovementAlertsSettingsProvider>
                                </AuthGate>
                            </SupabaseAuthProvider>
                        </NotificationProvider>
                    </AppGate>
                </LicenseProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
