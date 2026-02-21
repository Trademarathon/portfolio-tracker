"use client";

import { JournalProvider } from "@/contexts/JournalContext";
import { JournalHeader } from "@/components/Journal/JournalHeader";
import { JournalWebSocketIntegration } from "@/components/Journal/JournalWebSocketIntegration";
import { JournalTopNav } from "@/components/Journal/JournalTopNav";
import { KeyedChildren } from "@/components/Layout/KeyedChildren";
import { PageWrapper } from "@/components/Layout/PageWrapper";

export default function JournalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <JournalProvider>
            {/* Real-time WebSocket integration */}
            <JournalWebSocketIntegration key="journal-wss" />

            <div key="journal-layout-root" className="journal-neo-active min-h-screen bg-[#141310]">
                {/* Main Content */}
                <div key="journal-main-content" className="flex flex-col min-h-screen">
                    {/* Header */}
                    <JournalHeader key="journal-header" />

                    {/* Page Content */}
                    <main key="journal-main-area" className="flex-1 overflow-auto">
                        <PageWrapper className="flex flex-col gap-4 px-4 md:px-6 lg:px-8 pt-4 pb-12 max-w-none w-full">
                            <JournalTopNav key="journal-nav" />
                            <KeyedChildren key="journal-children-wrapper">{children}</KeyedChildren>
                        </PageWrapper>
                    </main>
                </div>
            </div>
        </JournalProvider>
    );
}
