"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"

const Popover = DialogPrimitive.Root
const PopoverTrigger = DialogPrimitive.Trigger

const PopoverContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { align?: "start" | "center" | "end" }
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Portal>
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "z-50 rounded-md border bg-[#0c0c0c] border-[#1a1a1a] p-4 text-zinc-300 shadow-md outline-none",
                className
            )}
            {...props}
        />
    </DialogPrimitive.Portal>
))
PopoverContent.displayName = DialogPrimitive.Content.displayName

const PopoverClose = DialogPrimitive.Close

export { Popover, PopoverTrigger, PopoverContent, PopoverClose }
