-- Create daily_intentions table
create table if not exists daily_intentions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  content text not null,
  vote text check (vote in ('up', 'down')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, date)
);

-- Create celebrations table
create table if not exists celebrations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text check (type in ('gold_streak', 'habit_streak')) not null,
  streak_days int not null,
  habit_id uuid, -- nullable, only for habit_streak
  content text not null,
  is_used boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table daily_intentions enable row level security;
alter table celebrations enable row level security;

-- Policies for daily_intentions
drop policy if exists "Users can view their own intentions" on daily_intentions;
create policy "Users can view their own intentions"
  on daily_intentions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own intentions" on daily_intentions;
create policy "Users can insert their own intentions"
  on daily_intentions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own intentions" on daily_intentions;
create policy "Users can update their own intentions"
  on daily_intentions for update
  using (auth.uid() = user_id);

-- Policies for celebrations
drop policy if exists "Users can view their own celebrations" on celebrations;
create policy "Users can view their own celebrations"
  on celebrations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own celebrations" on celebrations;
create policy "Users can insert their own celebrations"
  on celebrations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own celebrations" on celebrations;
create policy "Users can update their own celebrations"
  on celebrations for update
  using (auth.uid() = user_id);
