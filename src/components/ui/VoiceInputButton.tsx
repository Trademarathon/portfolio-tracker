"use client";

import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  isListening: boolean;
  isTranscribing?: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "p-2",
  md: "p-3",
  lg: "p-4",
};

const iconSizes = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

export function VoiceInputButton({
  isListening,
  isTranscribing = false,
  onClick,
  disabled = false,
  title,
  className,
  size = "md",
}: VoiceInputButtonProps) {
  const showActive = isListening || isTranscribing;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || isTranscribing}
      title={title}
      className={cn(
        "relative rounded-xl transition-all duration-300 overflow-hidden",
        sizeClasses[size],
        showActive
          ? "bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(248,113,113,0.3)]"
          : "bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/80",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      whileHover={!disabled ? { scale: 1.05 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
    >
      {/* Recording / Transcribing: Animated sound wave rings */}
      {showActive && (
        <>
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-red-400/40"
            animate={{
              scale: [1, 1.4, 1.4],
              opacity: [0.6, 0, 0],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-red-400/30"
            animate={{
              scale: [1, 1.6, 1.6],
              opacity: [0.4, 0, 0],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.2,
            }}
          />
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-red-400/20"
            animate={{
              scale: [1, 1.8, 1.8],
              opacity: [0.2, 0, 0],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.4,
            }}
          />
          {/* Inner glow pulse */}
          <motion.div
            className="absolute inset-0 rounded-xl bg-red-500/20"
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </>
      )}

      {/* Mic icon */}
      <motion.div
        className="relative z-10 flex items-center justify-center"
        animate={showActive ? { scale: [1, 1.1, 1] } : {}}
        transition={
          showActive
            ? {
                duration: 0.6,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : {}
        }
      >
        <Mic className={cn(iconSizes[size], showActive && "text-red-400")} />
      </motion.div>
    </motion.button>
  );
}
