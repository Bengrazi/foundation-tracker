export interface DailyIntention {
    id: string;
    user_id: string;
    date: string;
    content: string;
    vote: "up" | "down" | null;
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
