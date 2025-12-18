"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface HabitBubbleProps {
    id: string;
    title: string;
    currentCount: number;  // How many times done today
    targetCount: number;   // Goal (e.g. 1, 2, 3)
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
    const progress = Math.min(currentCount / targetCount, 1);

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
    // We'll draw an SVG overlay.
    // Radius for the stroke
    const R = 42;
    const C = 2 * Math.PI * R; // Circumference

    // If multiple segments, we need gaps.
    const gapPercent = targetCount > 1 ? 0.05 : 0; // 5% gap
    const segmentLength = (1 - gapPercent * targetCount) / targetCount;
    const strokeLength = C * segmentLength;
    const gapLength = C * gapPercent;

    // Create an array of segments
    const segments = Array.from({ length: targetCount }).map((_, i) => {
        const isFilled = i < currentCount;
        // Rotation: start from top (-90deg), + offset per segment
        const rotation = -90 + (i * (360 / targetCount));

        return {
            index: i,
            isFilled,
            rotation
        };
    });

    return (
        <motion.button
            className={`relative flex flex-col items-center justify-center w-full aspect-square rounded-full transition-all duration-300 shadow-sm
        ${isGoldState
                    ? "bg-gradient-to-br from-amber-300 to-yellow-500 text-white border-yellow-600 shadow-lg shadow-yellow-500/30 ring-2 ring-yellow-400/50"
                    : "bg-app-card border-app-border text-app-main hover:border-app-accent/50"
                }
         ${completed && !isGoldState ? "border-app-accent" : ""}
      `}
            style={{
                // If completed, fill background. If partial, maybe just stroke?
                // User wants: "fill up 1 at a time until full".
                // So background is white/card, segments fill with color.
                // Once full, maybe the whole bg fills? 
                // Let's rely on SVG for the "fill" visualization primarily, 
                // but IF completed, we fill the BG to match the "solid circle" look.
                backgroundColor: completed && !isGoldState ? "var(--accent-color)" : undefined
            }}
            onClick={onToggle}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            whileTap={{ scale: 0.95 }}
        >
            {/* SVG Progress Ring (Only if not gold state, as gold state overrides everything) */}
            {!isGoldState && (
                <svg className="absolute inset-0 w-full h-full p-0.5 pointer-events-none" viewBox="0 0 100 100">
                    {/* Background Track (faint) */}
                    {segments.map((seg) => (
                        <circle
                            key={`track-${seg.index}`}
                            cx="50" cy="50" r={R}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeOpacity="0.1"
                            strokeDasharray={`${strokeLength} ${C - strokeLength}`}
                            strokeDashoffset={0}
                            transform={`rotate(${seg.rotation} 50 50)`}
                        />
                    ))}

                    {/* Filled Segments */}
                    {segments.map((seg) => (
                        <circle
                            key={`fill-${seg.index}`}
                            cx="50" cy="50" r={R}
                            fill="none"
                            stroke={completed ? "transparent" : "var(--accent-color)"} // If full completed, we fill BG via CSS, so hide stroke to avoid aliasing? Or keep it?
                            strokeWidth="8"
                            strokeLinecap={targetCount > 1 ? "round" : "butt"}
                            strokeDasharray={`${strokeLength} ${C - strokeLength}`}
                            strokeDashoffset={0}
                            transform={`rotate(${seg.rotation} 50 50)`}
                            className={`transition-all duration-300 ${seg.isFilled ? "opacity-100" : "opacity-0"}`}
                        />
                    ))}
                </svg>
            )}

            {/* Content */}
            <div className={`relative z-10 flex flex-col items-center justify-center p-3 text-center pointer-events-none select-none w-full h-full
            ${completed && !isGoldState ? "text-app-accent-text" : "text-app-main"}
            ${isGoldState ? "text-white" : ""}
        `}>
                {/* Title */}
                <span className="font-semibold leading-tight line-clamp-2 w-full break-words text-[10px] sm:text-xs">
                    {/* Note: Utilizing Tailwind arbitrary values or relying on inherited font-size from parent grid if possible */}
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

                {/* Multi-step Counter if partial */}
                {!completed && targetCount > 1 && (
                    <div className="absolute bottom-2 text-[8px] opacity-60 font-mono">
                        {currentCount}/{targetCount}
                    </div>
                )}

                {/* Completed Checkmark (Subtle) */}
                {completed && !isGoldState && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        <span className="text-4xl font-bold">✓</span>
                    </div>
                )}
            </div>
        </motion.button>
    );
}
