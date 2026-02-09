"use client";

import { motion, useSpring, useTransform, useMotionValue } from "framer-motion";
import { useEffect } from "react";

interface AnimatedValueProps {
    value: number;
    currency?: string;
    decimals?: number;
    prefix?: string;
    className?: string;
}

export function AnimatedValue({ value, currency = "", decimals = 2, prefix = "", className }: AnimatedValueProps) {
    const motionValue = useMotionValue(value);
    const springValue = useSpring(motionValue, { damping: 15, stiffness: 100 });

    useEffect(() => {
        motionValue.set(value);
    }, [value, motionValue]);

    const display = useTransform(springValue, (latest) => {
        if (decimals === 0) return `${prefix}${Math.round(latest).toLocaleString()}${currency}`;
        return `${prefix}${latest.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${currency}`;
    });

    return <motion.span className={className}>{display}</motion.span>;
}
