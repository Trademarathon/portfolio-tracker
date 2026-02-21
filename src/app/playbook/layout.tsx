"use client";

import { JournalProvider } from "@/contexts/JournalContext";
import { KeyedChildren } from "@/components/Layout/KeyedChildren";

export default function PlaybookLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <JournalProvider key="playbook-provider">
            <KeyedChildren key="playbook-keyed-children">{children}</KeyedChildren>
        </JournalProvider>
    );
}
