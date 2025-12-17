"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HabitBubbleProps {
    id: string;
    title: string;
    completed: boolean;
    onToggle: () => void;
    onLongPress: () => void;
    isGoldReady?: boolean; // True if this is one of the last few habits needed for Gold
}

export function HabitBubble({ id, title, completed, onToggle, onLongPress, isGoldReady }: HabitBubbleProps) {
    const [isPressing, setIsPressing] = useState(false);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

    const handlePointerDown = () => {
        setIsPressing(true);
        const timer = setTimeout(() => {
            onLongPress();
            setIsPressing(false);
        }, 600); // 600ms long press
        setLongPressTimer(timer);
    };

    const handlePointerUp = () => {
        if (longPressTimer) clearTimeout(longPressTimer);
        setIsPressing(false);
    };

    const handleClick = () => {
        onToggle();
    };

    // Visual variants
    const variants = {
        idle: { scale: 1 },
        pressed: { scale: 0.9 },
        completed: { scale: [1, 1.1, 1], transition: { duration: 0.2 } }
    };

    // Truncate title or use initials if very long? 
    // Design: Large bubble with text inside.

    return (
        <motion.button
            className={`relative flex items-center justify-center w-full aspect-square rounded-full transition-colors duration-300 shadow-sm
        ${completed
                    ? "bg-app-accent text-app-accent-text border-app-accent"
                    : isGoldReady
                        ? "bg-app-card border-2 border-yellow-500/50 text-app-main"
                        : "bg-app-card border border-app-border text-app-main hover:border-app-accent/50"
                }
      `}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            animate={completed ? "completed" : isPressing ? "pressed" : "idle"}
            variants={variants}
            whileTap={{ scale: 0.9 }}
        >
            <div className="flex flex-col items-center justify-center p-2 text-center pointer-events-none select-none">
                {completed ? (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-2xl"
                    >
                        ✓
                    </motion.div>
                ) : (
                    <span className="text-[10px] font-semibold leading-tight line-clamp-3">
                        {title}
                    </span>
                )}
            </div>
        </motion.button>
    );
}
