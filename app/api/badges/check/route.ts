import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient(req: Request) {
    const authHeader = req.headers.get("Authorization");
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader ?? "" } },
    });
}

// Badge Definitions (Mirroring DB for logic checks)
// In a real app, strict logic might be in DB functions or complex, but here we do simple checks.
const BADGE_RULES = [
    { slug: 'gold_streak_1', threshold: 1, type: 'gold_streak' },
    { slug: 'gold_streak_7', threshold: 7, type: 'gold_streak' },
    { slug: 'gold_streak_30', threshold: 30, type: 'gold_streak' },
    { slug: 'gold_streak_100', threshold: 100, type: 'gold_streak' },
    { slug: 'gold_streak_365', threshold: 365, type: 'gold_streak' },
    { slug: 'gold_streak_1000', threshold: 1000, type: 'gold_streak' },
    // Recovery badges would need history analysis, skipping for MVP simple check
];

export async function POST(req: Request) {
    try {
        const supabase = getSupabaseClient(req);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Get User Profile for stats
        const { data: profile } = await supabase
            .from("profiles")
            .select("current_gold_streak, best_gold_streak")
            .eq("id", user.id)
            .single();

        if (!profile) return NextResponse.json({ newBadges: [] });

        const currentStreak = profile.current_gold_streak || 0;
        const bestStreak = profile.best_gold_streak || 0; // Use best for unlocking lifetime milestones? 
        // Usually milestones are "Reach X". "Best" is enough.
        const effectiveStreak = Math.max(currentStreak, bestStreak);

        // 2. Get User's Existing Badges
        const { data: userBadges } = await supabase
            .from("user_badges")
            .select("badge_id, badges(slug)")
            .eq("user_id", user.id);

        const ownedSlugs = new Set(userBadges?.map((ub: any) => ub.badges.slug) || []);
        const newBadges = [];

        // 3. Check Rules
        for (const rule of BADGE_RULES) {
            if (!ownedSlugs.has(rule.slug)) {
                if (rule.type === 'gold_streak' && effectiveStreak >= rule.threshold) {
                    // Award it
                    // Fetch badge ID
                    const { data: badgeDoc } = await supabase.from("badges").select("id, name").eq("slug", rule.slug).single();
                    if (badgeDoc) {
                        await supabase.from("user_badges").insert({
                            user_id: user.id,
                            badge_id: badgeDoc.id
                        });
                        newBadges.push(badgeDoc);
                    }
                }
            }
        }

        return NextResponse.json({ newBadges });
    } catch (error: any) {
        console.error("Badge Check Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
