-- ============================================
-- CHERRY APP - Complete Database Schema
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
  theme text DEFAULT 'cherry',
  text_size text DEFAULT 'small',
  points int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Foundations (Habits)
CREATE TABLE IF NOT EXISTS public.foundations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  -- Deprecated: schedule_type, x_per_week
  schedule_type text NOT NULL,
  x_per_week int,
  -- Discipline-First Columns
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

-- Points History (Cherry points ledger)
CREATE TABLE IF NOT EXISTS public.points_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount int NOT NULL,
  reason text NOT NULL,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. ADD MISSING COLUMNS (safe if already exist)
-- ============================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text DEFAULT 'cherry';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS text_size text DEFAULT 'small';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points int DEFAULT 0;
ALTER TABLE public.foundations ADD COLUMN IF NOT EXISTS order_index int DEFAULT 0;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS order_index int DEFAULT 0;
ALTER TABLE public.daily_intentions ADD COLUMN IF NOT EXISTS question text;

-- Discipline-First Pivot Columns
ALTER TABLE public.foundations ADD COLUMN IF NOT EXISTS days_of_week text[];
ALTER TABLE public.foundations ADD COLUMN IF NOT EXISTS times_per_day int DEFAULT 1;

-- Ensure profiles has points (total_cherries)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points int DEFAULT 0;

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

-- POINTS HISTORY
DROP POLICY IF EXISTS "Users can view their own points history" ON public.points_history;
CREATE POLICY "Users can view their own points history"
  ON public.points_history FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own points history" ON public.points_history;
CREATE POLICY "Users can insert their own points history"
  ON public.points_history FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================
-- 6. FUNCTIONS (RPCs)
-- ============================================

-- Atomic point updates (prevents race conditions)
CREATE OR REPLACE FUNCTION increment_points(user_id_input uuid, amount_input int)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET points = points + amount_input
  WHERE id = user_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. DATA FIXES (Run once to correct data)
-- ============================================

-- Recalculate all user points from history
UPDATE profiles
SET points = (
  SELECT COALESCE(SUM(amount), 0)
  FROM points_history
  WHERE points_history.user_id = profiles.id
);

-- ============================================
-- 8. RELOAD SCHEMA CACHE
-- ============================================

NOTIFY pgrst, 'reload schema';
