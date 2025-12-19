"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface HabitBubbleProps {
    id: string;
    title: string;
    currentCount: number;
    targetCount: number;
    streak: number;
    onToggle: () => void;
    onLongPress: () => void;
    isGoldReady?: boolean;
    isGoldState?: boolean;
}

export function HabitBubble({
    id,
    title,
    currentCount,
    targetCount,
    streak,
    onToggle,
    onLongPress,
    isGoldReady,
    isGoldState,
}: HabitBubbleProps) {
    const [isPressing, setIsPressing] = useState(false);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

    const completed = currentCount >= targetCount;

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

    // --- SVG Logic for Segments ---
    const R = 42;
    const C = 2 * Math.PI * R;

    const gapPercent = targetCount > 1 ? 0.05 : 0;
    const segmentLength = (1 - gapPercent * targetCount) / targetCount;
    const strokeLength = C * segmentLength;

    const segments = Array.from({ length: targetCount }).map((_, i) => {
        const isFilled = i < currentCount;
        const rotation = -90 + (i * (360 / targetCount));

        return {
            index: i,
            isFilled,
            rotation
        };
    });

    // Calculate text color class to ensure high contrast
    let textColorClass = "text-app-main"; // Default (read-able on card bg)
    if (isGoldState) {
        textColorClass = "text-white";
    } else if (completed) {
        textColorClass = "text-app-accent-text";
    }

    return (
        <motion.button
            className={`relative flex flex-col items-center justify-center w-full aspect-square rounded-full transition-all duration-300 shadow-sm
        ${isGoldState
                    ? "bg-gradient-to-br from-amber-300 to-yellow-500 border-yellow-600 shadow-lg shadow-yellow-500/30 ring-2 ring-yellow-400/50"
                    : "bg-app-card border-app-border hover:border-app-accent/50" // Base state
                }
         ${completed && !isGoldState ? "bg-app-accent border-app-accent" : ""} 
      `}
            onClick={onToggle}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            whileTap={{ scale: 0.95 }}
        >
            {/* SVG Progress Ring */}
            {!isGoldState && (
                <svg className="absolute inset-0 w-full h-full p-0.5 pointer-events-none" viewBox="0 0 100 100">
                    {/* Background Track */}
                    {segments.map((seg) => (
                        <circle
                            key={`track-${seg.index}`}
                            cx="50" cy="50" r={R}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeOpacity="0.1" // Faint track
                            strokeDasharray={`${strokeLength} ${C - strokeLength}`}
                            strokeDashoffset={0}
                            transform={`rotate(${seg.rotation} 50 50)`}
                        />
                    ))}

                    {/* Filled Segments with Animation */}
                    {segments.map((seg) => (
                        <motion.circle
                            key={`fill-${seg.index}`}
                            cx="50" cy="50" r={R}
                            fill="none"
                            // Using text-app-accent via class to ensure we pick up the theme variable
                            className={seg.isFilled ? "text-app-accent" : "text-transparent"}
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap={targetCount > 1 ? "round" : "butt"}
                            strokeDasharray={`${strokeLength} ${C - strokeLength}`}
                            strokeDashoffset={0}
                            transform={`rotate(${seg.rotation} 50 50)`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: seg.isFilled ? 1 : 0 }}
                            transition={{ duration: 0.3 }}
                        />
                    ))}
                </svg>
            )}

            {/* Content */}
            <div className={`relative z-10 flex flex-col items-center justify-center p-3 text-center pointer-events-none select-none w-full h-full ${textColorClass}`}>
                {/* Title */}
                <span className="font-semibold leading-tight line-clamp-2 w-full break-words text-[10px] sm:text-xs">
                    {title}
                </span>

                {/* Streak */}
                <div className={`mt-1 flex items-center gap-0.5 transition-opacity ${completed ? "opacity-90" : "opacity-70"}`}>
                    {streak > 0 && (
                        <>
                            <span className="text-[10px]">🔥</span>
                            <span className="text-[10px] font-bold">{streak}</span>
                        </>
                    )}
                </div>

                {/* Counter */}
                {!completed && targetCount > 1 && (
                    <div className="absolute bottom-2 text-[8px] opacity-60 font-mono">
                        {currentCount}/{targetCount}
                    </div>
                )}

                {/* Checkmark */}
                {completed && !isGoldState && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                        <span className="text-4xl font-bold">✓</span>
                    </div>
                )}
            </div>
        </motion.button>
    );
}
