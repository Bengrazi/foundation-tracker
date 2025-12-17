"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface HabitBubbleProps {
    id: string;
    title: string;
    completed: boolean;
    streak: number; // New prop for streak count
    onToggle: () => void;
    onLongPress: () => void;
    isGoldReady?: boolean;
    isGoldState?: boolean;
}

export function HabitBubble({ id, title, completed, streak, onToggle, onLongPress, isGoldReady, isGoldState }: HabitBubbleProps) {
    const [isPressing, setIsPressing] = useState(false);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

    const handlePointerDown = () => {
        setIsPressing(true);
        const timer = setTimeout(() => {
            onLongPress();
            setIsPressing(false);
        }, 600);
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
        completed: { scale: [1, 1.05, 1], transition: { duration: 0.2 } },
        gold: { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 2 } }
    };

    return (
        <motion.button
            className={`relative flex flex-col items-center justify-center w-full aspect-square rounded-full transition-all duration-300 shadow-sm overflow-hidden
        ${isGoldState
                    ? "bg-gradient-to-br from-amber-300 to-yellow-500 text-white border-yellow-600 shadow-lg shadow-yellow-500/30 ring-2 ring-yellow-400/50"
                    : completed
                        ? "bg-app-accent border-app-accent text-app-accent-text"
                        : isGoldReady
                            ? "bg-app-card border-2 border-yellow-500/50 text-app-main"
                            : "bg-app-card border border-app-border text-app-main hover:border-app-accent/50"
                }
      `}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            animate={isGoldState ? "gold" : completed ? "completed" : isPressing ? "pressed" : "idle"}
            variants={variants}
            whileTap={{ scale: 0.9 }}
        >
            {/* Content Container */}
            <div className="flex flex-col items-center justify-center p-2 text-center pointer-events-none select-none w-full h-full relative z-10">
                {/* Title (Always visible) */}
                <span className={`text-[10px] font-semibold leading-tight line-clamp-2 w-full break-words ${completed ? "opacity-100" : "opacity-90"}`}>
                    {title}
                </span>

                {/* Streak Counter */}
                <div className={`mt-1 flex items-center gap-0.5 transition-opacity ${completed ? "opacity-90" : "opacity-70"}`}>
                    {streak > 0 && (
                        <>
                            <span className="text-[10px]">🔥</span>
                            <span className="text-[10px] font-bold">{streak}</span>
                        </>
                    )}
                </div>

                {/* Completed Checkmark Overlay (Subtle) */}
                {completed && !isGoldState && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        <span className="text-4xl font-bold">✓</span>
                    </div>
                )}
            </div>
        </motion.button>
    );
}
