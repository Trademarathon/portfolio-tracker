"use client";

import { cn } from "@/lib/utils";
import { STRATEGY_TAGS, StrategyTagId, getStrategyTag } from "@/lib/api/journal-types";
import { Check, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface StrategyTagSelectorProps {
    value?: StrategyTagId;
    onChange: (tag: StrategyTagId) => void;
    size?: 'sm' | 'md';
    className?: string;
}

export function StrategyTagSelector({ value, onChange, size = 'md', className }: StrategyTagSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedTag = value ? getStrategyTag(value) : null;

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} className={cn("relative", className)}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors",
                    size === 'sm' ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
                    isOpen && "ring-2 ring-primary/50"
                )}
            >
                {selectedTag ? (
                    <>
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: selectedTag.color }}
                        />
                        <span className="font-medium">{selectedTag.name}</span>
                    </>
                ) : (
                    <span className="text-muted-foreground">Select Strategy...</span>
                )}
                <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-64 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
                        {STRATEGY_TAGS.map(tag => (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => {
                                    onChange(tag.id);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                                    value === tag.id
                                        ? "bg-primary/20 text-primary"
                                        : "hover:bg-white/5"
                                )}
                            >
                                <span
                                    className="h-3 w-3 rounded-full shrink-0"
                                    style={{ backgroundColor: tag.color }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{tag.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{tag.description}</p>
                                </div>
                                {value === tag.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Badge variant for inline display
interface StrategyBadgeProps {
    tag: StrategyTagId;
    size?: 'xs' | 'sm';
    className?: string;
}

export function StrategyBadge({ tag, size = 'sm', className }: StrategyBadgeProps) {
    const tagInfo = getStrategyTag(tag);
    if (!tagInfo) return null;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full font-medium",
                size === 'xs' ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
                className
            )}
            style={{
                backgroundColor: `${tagInfo.color}20`,
                color: tagInfo.color,
                border: `1px solid ${tagInfo.color}40`,
            }}
        >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagInfo.color }} />
            {tagInfo.name}
        </span>
    );
}
