"use client";

import { ReactNode } from "react";

export default function Template({ children }: { children: ReactNode }) {
    return (
        <div key="app-template" className="w-full h-full">
            {children}
        </div>
    );
}
