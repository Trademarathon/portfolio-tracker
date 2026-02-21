"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
    sectionName?: string;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("[SectionErrorBoundary]", this.props.sectionName ?? "Section", error, errorInfo);
    }

    retry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-center">
                    <p className="text-xs text-zinc-400 mb-2">
                        Failed to load{this.props.sectionName ? ` ${this.props.sectionName}` : ""}.
                    </p>
                    <button
                        type="button"
                        onClick={this.retry}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
