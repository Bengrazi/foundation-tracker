-- ============================================
-- FOUNDATION APP - Complete Database Schema
-- Safe to run multiple times (idempotent)
-- ============================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. CREATE TABLES
-- ============================================

-- Profiles (User settings & AI context)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  priorities text,
  life_summary text,
  ideology text,
  key_truth text,
  ai_voice text,
  theme text DEFAULT 'foundation',
  text_size text DEFAULT 'small',
  points int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Foundations (Habits)
CREATE TABLE IF NOT EXISTS public.foundations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  schedule_type text NOT NULL,
  x_per_week int,
  days_of_week text[], -- Array of strings e.g. ['Mon', 'Tue', 'Fri']
  times_per_day int DEFAULT 1,
  start_date text NOT NULL,
  end_date text,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Foundation Logs (Habit completions)
CREATE TABLE IF NOT EXISTS public.foundation_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  foundation_id uuid REFERENCES public.foundations ON DELETE CASCADE NOT NULL,
  date text NOT NULL,
  completed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Goals
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  status text DEFAULT 'not_started',
  target_date text,
  horizon text NOT NULL,
  pinned boolean DEFAULT false,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Reflections (Journal)
CREATE TABLE IF NOT EXISTS public.reflections (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  day text NOT NULL,
  mood int,
  text text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, day)
);

-- Daily Intentions
CREATE TABLE IF NOT EXISTS public.daily_intentions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date text NOT NULL,
  content text NOT NULL,
  vote text CHECK (vote IN ('up', 'down')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Board Members (AI advisory board)
CREATE TABLE IF NOT EXISTS public.board_members (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  why text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Celebrations (Streak celebrations)
CREATE TABLE IF NOT EXISTS public.celebrations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('gold_streak', 'habit_streak')) NOT NULL,
  streak_days int NOT NULL,
  habit_id uuid,
  content text NOT NULL,
  is_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Points History
CREATE TABLE IF NOT EXISTS public.points_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount int NOT NULL,
  reason text NOT NULL,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

-- BADGES SYSTEM (New for FOUNDATION)
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL, -- 'gold_streak', 'recovery', 'habit_streak'
  tier int DEFAULT 1, -- 1=common, 2=rare, 3=epic, 4=legendary
  image_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  badge_id uuid REFERENCES public.badges ON DELETE CASCADE NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- ============================================
-- 3. ADD MISSING COLUMNS
-- ============================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text DEFAULT 'foundation';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS text_size text DEFAULT 'small';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points int DEFAULT 0;
ALTER TABLE public.foundations ADD COLUMN IF NOT EXISTS order_index int DEFAULT 0;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS order_index int DEFAULT 0;
ALTER TABLE public.daily_intentions ADD COLUMN IF NOT EXISTS question text;
ALTER TABLE public.daily_intentions ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false;
ALTER TABLE public.daily_intentions ADD COLUMN IF NOT EXISTS is_ongoing boolean DEFAULT false;

-- Discipline-First Columns
ALTER TABLE public.foundations ADD COLUMN IF NOT EXISTS days_of_week text[];
ALTER TABLE public.foundations ADD COLUMN IF NOT EXISTS times_per_day int DEFAULT 1;

-- Streak Tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_gold_streak int DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_gold_date text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS best_gold_streak int DEFAULT 0;

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foundations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foundation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celebrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- FOUNDATIONS
DROP POLICY IF EXISTS "Users can view their own foundations" ON public.foundations;
CREATE POLICY "Users can view their own foundations"
  ON public.foundations FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own foundations" ON public.foundations;
CREATE POLICY "Users can insert their own foundations"
  ON public.foundations FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own foundations" ON public.foundations;
CREATE POLICY "Users can update their own foundations"
  ON public.foundations FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own foundations" ON public.foundations;
CREATE POLICY "Users can delete their own foundations"
  ON public.foundations FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- FOUNDATION LOGS
DROP POLICY IF EXISTS "Users can view their own foundation logs" ON public.foundation_logs;
CREATE POLICY "Users can view their own foundation logs"
  ON public.foundation_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.foundations f
    WHERE f.id = foundation_logs.foundation_id AND f.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert their own foundation logs" ON public.foundation_logs;
CREATE POLICY "Users can insert their own foundation logs"
  ON public.foundation_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.foundations f
    WHERE f.id = foundation_logs.foundation_id AND f.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update their own foundation logs" ON public.foundation_logs;
CREATE POLICY "Users can update their own foundation logs"
  ON public.foundation_logs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.foundations f
    WHERE f.id = foundation_logs.foundation_id AND f.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.foundations f
    WHERE f.id = foundation_logs.foundation_id AND f.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users can delete their own foundation logs" ON public.foundation_logs;
CREATE POLICY "Users can delete their own foundation logs"
  ON public.foundation_logs FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.foundations f
    WHERE f.id = foundation_logs.foundation_id AND f.user_id = (SELECT auth.uid())
  ));

-- GOALS
DROP POLICY IF EXISTS "Users can view their own goals" ON public.goals;
CREATE POLICY "Users can view their own goals"
  ON public.goals FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own goals" ON public.goals;
CREATE POLICY "Users can insert their own goals"
  ON public.goals FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own goals" ON public.goals;
CREATE POLICY "Users can update their own goals"
  ON public.goals FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own goals" ON public.goals;
CREATE POLICY "Users can delete their own goals"
  ON public.goals FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- REFLECTIONS
DROP POLICY IF EXISTS "Users can view their own reflections" ON public.reflections;
CREATE POLICY "Users can view their own reflections"
  ON public.reflections FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own reflections" ON public.reflections;
CREATE POLICY "Users can insert their own reflections"
  ON public.reflections FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own reflections" ON public.reflections;
CREATE POLICY "Users can update their own reflections"
  ON public.reflections FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own reflections" ON public.reflections;
CREATE POLICY "Users can delete their own reflections"
  ON public.reflections FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- DAILY INTENTIONS
DROP POLICY IF EXISTS "Users can view their own intentions" ON public.daily_intentions;
CREATE POLICY "Users can view their own intentions"
  ON public.daily_intentions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own intentions" ON public.daily_intentions;
CREATE POLICY "Users can insert their own intentions"
  ON public.daily_intentions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own intentions" ON public.daily_intentions;
CREATE POLICY "Users can update their own intentions"
  ON public.daily_intentions FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own intentions" ON public.daily_intentions;
CREATE POLICY "Users can delete their own intentions"
  ON public.daily_intentions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- BOARD MEMBERS
DROP POLICY IF EXISTS "Users can view their own board members" ON public.board_members;
CREATE POLICY "Users can view their own board members"
  ON public.board_members FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own board members" ON public.board_members;
CREATE POLICY "Users can insert their own board members"
  ON public.board_members FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own board members" ON public.board_members;
CREATE POLICY "Users can update their own board members"
  ON public.board_members FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own board members" ON public.board_members;
CREATE POLICY "Users can delete their own board members"
  ON public.board_members FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- CELEBRATIONS
DROP POLICY IF EXISTS "Users can view their own celebrations" ON public.celebrations;
CREATE POLICY "Users can view their own celebrations"
  ON public.celebrations FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own celebrations" ON public.celebrations;
CREATE POLICY "Users can insert their own celebrations"
  ON public.celebrations FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own celebrations" ON public.celebrations;
CREATE POLICY "Users can update their own celebrations"
  ON public.celebrations FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own celebrations" ON public.celebrations;
CREATE POLICY "Users can delete their own celebrations"
  ON public.celebrations FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- POINTS HISTORY
DROP POLICY IF EXISTS "Users can view their own points history" ON public.points_history;
CREATE POLICY "Users can view their own points history"
  ON public.points_history FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own points history" ON public.points_history;
CREATE POLICY "Users can insert their own points history"
  ON public.points_history FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own points history" ON public.points_history;
CREATE POLICY "Users can delete their own points history"
  ON public.points_history FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- BADGES
DROP POLICY IF EXISTS "Everyone can view badges" ON public.badges;
CREATE POLICY "Everyone can view badges" ON public.badges FOR SELECT TO authenticated USING (true);

-- USER BADGES
DROP POLICY IF EXISTS "Users can view their own badges" ON public.user_badges;
CREATE POLICY "Users can view their own badges" ON public.user_badges FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;
CREATE POLICY "Users can insert their own badges" ON public.user_badges FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);


-- ============================================
-- 6. SEED DATA (Badges)
-- ============================================

INSERT INTO public.badges (slug, name, description, category, tier) VALUES
('gold_streak_1', 'First Step', 'One perfect day.', 'gold_streak', 1),
('gold_streak_7', 'Week of Iron', 'Seven perfect days.', 'gold_streak', 2),
('gold_streak_30', 'Month of Discipline', 'Thirty perfect days.', 'gold_streak', 2),
('gold_streak_100', 'Centurion', '100 perfect days.', 'gold_streak', 3),
('gold_streak_365', 'HERO', 'One full year of perfection.', 'gold_streak', 4),
('gold_streak_1000', 'LEGEND', '1000 days. You are built different.', 'gold_streak', 4),
('comeback_kid', 'Don''t Call It a Comeback', 'Returned to perfection after a fall.', 'recovery', 2),
('iron_mind', 'IRON MIND', 'Multiple long streaks across time.', 'recovery', 3)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 7. FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION increment_points(user_id_input uuid, amount_input int)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET points = points + amount_input
  WHERE id = user_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. RELOAD SCHEMA CACHE
-- ============================================

NOTIFY pgrst, 'reload schema';
