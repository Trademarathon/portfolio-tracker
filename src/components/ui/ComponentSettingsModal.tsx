"use client";

import { type ReactNode } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type LucideIcon, Settings2, ExternalLink } from "lucide-react";
import Link from "next/link";

export interface ComponentSettingsTab {
    value: string;
    label: string;
    icon?: LucideIcon;
    content: ReactNode;
}

export interface ComponentSettingsModalProps {
    /** Trigger: default is a gear icon button */
    trigger?: ReactNode;
    /** Modal title (e.g. "TERMINAL CHART ENGINE") */
    title: string;
    /** Subtitle (e.g. "Custom Visualization Core") */
    subtitle?: string;
    /** Icon shown next to title */
    icon?: LucideIcon;
    /** Single content (no tabs) or tab definitions */
    tabs?: ComponentSettingsTab[];
    children?: ReactNode;
    /** Footer: "Reset defaults" callback */
    onReset?: () => void;
    /** Footer: primary button label (e.g. "Apply Changes"); if set, onClick is called and dialog can close */
    applyLabel?: string;
    onApply?: () => void;
    /** Link to full settings page (e.g. "/settings?tab=general"); shown as secondary text + icon */
    fullSettingsHref?: string;
    fullSettingsLabel?: string;
    /** Max height for scrollable content (default 60vh) */
    maxContentHeight?: string;
    /** Dialog content class */
    className?: string;
}

const defaultTrigger = (
    <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 shadow-xl backdrop-blur-md border border-white/5"
        aria-label="Open settings"
    >
        <Settings2 className="h-4 w-4" />
    </Button>
);

export function ComponentSettingsModal({
    trigger = defaultTrigger,
    title,
    subtitle,
    icon: Icon = Settings2,
    tabs: tabDefs,
    children,
    onReset,
    applyLabel = "Apply Changes",
    onApply,
    fullSettingsHref,
    fullSettingsLabel = "Open full settings",
    maxContentHeight = "60vh",
    className = "",
}: ComponentSettingsModalProps) {
    const hasTabs = Array.isArray(tabDefs) && tabDefs.length > 0;
    const singleContent = !hasTabs && children != null;

    const handleApply = () => {
        onApply?.();
    };

    return (
        <Dialog>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent
                className={
                    "sm:max-w-[480px] bg-[#0c0c0e]/95 backdrop-blur-2xl border-white/10 text-white shadow-[0_0_50px_rgba(0,0,0,0.5)] " +
                    className
                }
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                            <Icon className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-lg font-black tracking-tight uppercase italic text-white/90">
                                {title}
                            </span>
                            {subtitle && (
                                <p className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] mt-0.5">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {hasTabs ? (
                    <Tabs defaultValue={tabDefs![0].value} className="mt-6">
                        <TabsList className="flex flex-wrap w-full bg-white/5 h-auto min-h-10 p-1 gap-1">
                            {tabDefs!.map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-indigo-600"
                                >
                                    {tab.icon && <tab.icon size={12} />}
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <ScrollArea style={{ maxHeight: maxContentHeight }} className="pr-2 mt-4 custom-scrollbar">
                            {tabDefs!.map((tab) => (
                                <TabsContent
                                    key={tab.value}
                                    value={tab.value}
                                    className="space-y-4 pt-4 animate-in slide-in-from-right-2 duration-200 mt-0"
                                >
                                    {tab.content}
                                </TabsContent>
                            ))}
                        </ScrollArea>
                    </Tabs>
                ) : singleContent ? (
                    <ScrollArea style={{ maxHeight: maxContentHeight }} className="pr-2 mt-4 custom-scrollbar">
                        <div className="space-y-4 pt-2">{children}</div>
                    </ScrollArea>
                ) : null}

                <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
                    {fullSettingsHref && (
                        <Link
                            href={fullSettingsHref}
                            className="inline-flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-indigo-400 uppercase tracking-widest"
                        >
                            <ExternalLink className="h-3 w-3" />
                            {fullSettingsLabel}
                        </Link>
                    )}
                    <div className="flex gap-3">
                        {onReset && (
                            <Button
                                variant="outline"
                                onClick={onReset}
                                className="flex-1 border-white/5 bg-transparent hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500 h-10"
                            >
                                Reset Defaults
                            </Button>
                        )}
                        <DialogClose asChild>
                            <Button
                                onClick={handleApply}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-black uppercase tracking-widest h-10"
                            >
                                {applyLabel}
                            </Button>
                        </DialogClose>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
