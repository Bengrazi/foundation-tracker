"use client";

import React, { useState, useEffect } from "react";

interface DailyIntentionProps {
    intention: string;
    locked: boolean;
    onUpdate: (newIntention: string) => Promise<void>;
    onLock: () => Promise<void>;
}

export function DailyIntention({ intention, locked, onUpdate, onLock }: DailyIntentionProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempIntention, setTempIntention] = useState(intention);

    useEffect(() => {
        setTempIntention(intention);
    }, [intention]);

    const handleSave = async () => {
        if (tempIntention.trim() !== intention) {
            await onUpdate(tempIntention);
        }
        setIsEditing(false);
    };

    return (
        <div className="w-full max-w-md mx-auto mb-2 px-4">
            <div className="relative group">
                {isEditing ? (
                    <div className="relative">
                        <textarea
                            value={tempIntention}
                            onChange={(e) => setTempIntention(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSave();
                                }
                            }}
                            className="w-full bg-app-card border border-app-border rounded-xl p-4 text-center text-lg md:text-xl italic font-serif text-app-main focus:outline-none focus:ring-1 focus:ring-app-accent resize-none"
                            rows={2}
                            autoFocus
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <h1
                            onClick={() => !locked && setIsEditing(true)}
                            className={`text-lg md:text-xl font-serif italic text-app-main text-center leading-relaxed px-4 py-2 rounded-xl transition-colors ${!locked ? "cursor-pointer hover:bg-app-card/30" : ""}`}
                        >
                            &ldquo;{intention || "Discipline is the bridge between goals and accomplishment."}&rdquo;
                        </h1>

                        <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            {!locked && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="text-xs text-app-muted hover:text-app-main uppercase tracking-wider flex items-center gap-1"
                                >
                                    <span className="text-sm">✎</span> Edit
                                </button>
                            )}
                            <button
                                onClick={onLock}
                                disabled={locked}
                                className={`text-xs uppercase tracking-wider flex items-center gap-1 ${locked ? "text-app-accent cursor-default" : "text-app-muted hover:text-app-accent"}`}
                            >
                                {locked ? <span className="text-sm">🔒</span> : <span className="text-sm">🔓</span>}
                                {locked ? "Locked" : "Lock"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
