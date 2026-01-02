export interface DailyIntention {
    id: string;
    user_id: string;
    date: string;
    content: string;
    vote: "up" | "down" | null;
    locked: boolean;
    created_at: string;
}

export interface Celebration {
    id: string;
    user_id: string;
    type: "gold_streak" | "habit_streak";
    streak_days: number;
    habit_id?: string;
    content: string;
    is_used: boolean;
    created_at: string;
}

export type Horizon = "3y" | "1y" | "6m" | "1m";
export type GoalStatus = "not_started" | "in_progress" | "achieved";

export interface Goal {
    id: string;
    user_id: string;
    title: string;
    status: GoalStatus;
    target_date: string;
    horizon: Horizon;
    order_index: number;
}

export interface Foundation {
    id: string;
    title: string;
    schedule_type: "daily" | "weekdays" | "weekly" | "monthly" | "xPerWeek";
    x_per_week: number | null;
    start_date: string;
    end_date: string | null;
    user_id: string;

    // New fields for Discipline-First
    order_index?: number;
    days_of_week?: string[]; // e.g. ["Mon", "Tue"]
    times_per_day?: number; // e.g. 1
}

export interface UserProfile {
    id: string;
    theme: string;
    text_size: string;
    points: number;
    priorities: string | null;
    life_summary: string | null;
    current_gold_streak?: number;
    last_gold_date?: string;
    best_gold_streak?: number;
}

export interface Badge {
    id: string;
    slug: string;
    name: string;
    description: string;
    category: "gold_streak" | "recovery" | "habit_streak";
    tier: number;
    image_url?: string;
    metadata?: any;
    created_at: string;
}

export interface UserBadge {
    id: string;
    user_id: string;
    badge_id: string;
    unlocked_at: string;
}
