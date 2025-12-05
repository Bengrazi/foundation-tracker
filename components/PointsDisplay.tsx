"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function PointsDisplay() {
    const [points, setPoints] = useState<number | null>(null);

    useEffect(() => {
        const fetchPoints = async () => {
            const { data: auth } = await supabase.auth.getUser();
            if (!auth?.user) return;

            const { data } = await supabase
                .from("profiles")
                .select("points")
                .eq("id", auth.user.id)
                .single();

            if (data) {
                setPoints(data.points || 0);
            }
        };

        fetchPoints();

        // Subscribe to changes
        const channel = supabase
            .channel("points_update")
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "profiles",
                },
                (payload) => {
                    setPoints((payload.new as any).points);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    if (points === null) return null;

    return (
        <div className="flex items-center gap-1.5 rounded-full bg-app-card px-3 py-1 text-xs font-medium text-app-main shadow-sm border border-app-border">
            <span className="text-base">🍒</span>
            <span>{points.toLocaleString()}</span>
        </div>
    );
}
