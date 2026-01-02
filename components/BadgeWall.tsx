"use client";

import React from "react";
import { Badge, UserBadge } from "@/lib/engagementTypes";
import { format } from "date-fns";

interface BadgeWallProps {
    badges: Badge[];
    userBadges: UserBadge[];
}

export function BadgeWall({ badges, userBadges }: BadgeWallProps) {
    // Sort badges: Tier ascension
    const sortedBadges = [...badges].sort((a, b) => a.tier - b.tier);

    return (
        <div className="space-y-8">
            <h2 className="text-sm font-bold text-app-muted uppercase tracking-widest text-center mb-4">
                The Foundation Wall
            </h2>
            <div className="grid grid-cols-2 gap-4">
                {sortedBadges.map((badge) => {
                    const unlocked = userBadges.find((ub) => ub.badge_id === badge.id);
                    return <BadgeCard key={badge.id} badge={badge} userBadge={unlocked} />;
                })}
            </div>
        </div>
    );
}

function BadgeCard({ badge, userBadge }: { badge: Badge; userBadge?: UserBadge }) {
    const isUnlocked = !!userBadge;

    // Badge styling based on Tier
    // Common (1) -> Stone
    // Rare (2) -> Iron/Bronze
    // Epic (3) -> Silver/Steel
    // Legendary (4) -> Gold
    let borderColor = "border-app-border";
    let bgColor = "bg-app-card";
    let textColor = "text-app-muted";
    let glow = "";

    if (isUnlocked) {
        textColor = "text-app-main";
        if (badge.tier === 1) { // Stone
            borderColor = "border-stone-500";
            bgColor = "bg-stone-900";
        } else if (badge.tier === 2) { // Iron
            borderColor = "border-orange-900";
            bgColor = "bg-orange-950";
            textColor = "text-orange-200";
        } else if (badge.tier === 3) { // Silver
            borderColor = "border-slate-400";
            bgColor = "bg-slate-800";
            textColor = "text-slate-100";
            glow = "shadow-[0_0_15px_rgba(148,163,184,0.3)]";
        } else if (badge.tier === 4) { // Gold/Legendary
            borderColor = "border-yellow-600";
            bgColor = "bg-yellow-950";
            textColor = "text-yellow-100";
            glow = "shadow-[0_0_20px_rgba(234,179,8,0.4)]";
        }
    } else {
        // Locked
        bgColor = "bg-app-card/30";
        borderColor = "border-app-border/30";
        textColor = "text-app-muted/20";
    }

    return (
        <div className={`
            relative p-4 rounded-lg border-2 flex flex-col items-center text-center transition-all duration-500
            ${borderColor} ${bgColor} ${glow}
            ${!isUnlocked ? "grayscale opacity-50" : "scale-100"}
        `}>
            {/* Visual Icon Check */}
            <div className={`text-2xl mb-2 ${isUnlocked ? "" : "opacity-0"}`}>
                {badge.tier === 4 ? "👑" : badge.tier === 3 ? "⚔️" : badge.tier === 2 ? "🛡️" : "🧱"}
            </div>

            <h3 className={`font-bold text-sm tracking-wide ${textColor}`}>
                {badge.name}
            </h3>

            <p className="text-[10px] text-app-muted mt-1 leading-tight">
                {badge.description}
            </p>

            {isUnlocked && (
                <div className="mt-3 text-[9px] text-app-muted uppercase tracking-widest bg-black/20 px-2 py-1 rounded">
                    {format(new Date(userBadge.unlocked_at), "MMM d, yyyy")}
                </div>
            )}
        </div>
    );
}
