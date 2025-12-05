"use client";

import { useEffect, useState } from "react";

interface Props {
    message: string;
    onClose: () => void;
}

export function CelebrationModal({ message, onClose }: Props) {
    // Prevent scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "unset";
        };
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 backdrop-blur-md animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div
                className="relative max-w-sm text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-6 flex justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-app-accent/20 ring-4 ring-app-accent/50 animate-bounce">
                        <span className="text-4xl">🍒</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                        Milestone Unlocked
                    </h3>
                    <p className="text-lg font-medium leading-relaxed text-white/90 font-serif italic">
                        &ldquo;{message}&rdquo;
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="mt-8 rounded-full bg-white px-8 py-3 text-sm font-bold text-black hover:bg-gray-100 transition-colors"
                >
                    Continue
                </button>
            </div>
        </div>
    );
}
