create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  birth_date date,
  sex text,
  height_cm numeric,
  fitness_level text check (fitness_level in ('beginner', 'intermediate', 'advanced', 'athlete')),
  primary_goal text,
  dietary_preference text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null,
  title text not null,
  target_value numeric,
  target_unit text,
  target_date date,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text not null,
  equipment text,
  movement_type text,
  difficulty text,
  instructions text,
  video_url text,
  created_at timestamptz default now()
);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  position int not null,
  target_sets int,
  target_reps text,
  target_weight numeric,
  rest_seconds int
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.workout_templates(id),
  name text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_seconds int,
  notes text,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  set_number int not null,
  reps int,
  weight numeric,
  duration_seconds int,
  distance_meters numeric,
  rpe numeric,
  completed boolean default false,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric,
  body_fat_percent numeric,
  waist_cm numeric,
  hips_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  notes text
);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  barcode text unique,
  serving_size numeric,
  serving_unit text,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric default 0,
  sugar_g numeric default 0,
  sodium_mg numeric default 0,
  verified boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  created_at timestamptz default now()
);

create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null references public.meal_logs(id) on delete cascade,
  food_id uuid references public.foods(id),
  food_name text not null,
  quantity numeric not null,
  unit text,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0
);

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  amount_ml int not null
);

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sleep_start timestamptz not null,
  sleep_end timestamptz not null,
  quality_rating int check (quality_rating between 1 and 5),
  notes text
);

create table if not exists public.mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  mood_score int check (mood_score between 1 and 5),
  stress_score int check (stress_score between 1 and 5),
  energy_score int check (energy_score between 1 and 5),
  notes text
);

create table if not exists public.daily_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  water_ml int default 2000,
  steps int default 8000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  metric_type text not null,
  value numeric not null,
  unit text not null,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
alter table public.body_measurements enable row level security;
alter table public.foods enable row level security;
alter table public.meal_logs enable row level security;
alter table public.meal_items enable row level security;
alter table public.water_logs enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.mood_logs enable row level security;
alter table public.daily_targets enable row level security;
alter table public.health_metrics enable row level security;

create policy "Users can access their own profiles"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can access their own goals"
on public.goals
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Authenticated users can read exercises"
on public.exercises
for select
to authenticated
using (true);

create policy "Authenticated users can read foods"
on public.foods
for select
to authenticated
using (true);

create policy "Authenticated users can add foods"
on public.foods
for insert
to authenticated
with check (true);

create policy "Users can access their own workout templates"
on public.workout_templates
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can access exercises in their own workout templates"
on public.workout_template_exercises
for all
using (
  exists (
    select 1
    from public.workout_templates template
    where template.id = workout_template_exercises.template_id
      and template.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_templates template
    where template.id = workout_template_exercises.template_id
      and template.user_id = auth.uid()
  )
);

create policy "Users can access their own workout sessions"
on public.workout_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can access sets from their own sessions"
on public.workout_sets
for all
using (
  exists (
    select 1
    from public.workout_sessions session
    where session.id = workout_sets.session_id
      and session.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_sessions session
    where session.id = workout_sets.session_id
      and session.user_id = auth.uid()
  )
);

create policy "Users can access their own body measurements"
on public.body_measurements
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can access their own meal logs"
on public.meal_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can access items from their own meal logs"
on public.meal_items
for all
using (
  exists (
    select 1
    from public.meal_logs meal
    where meal.id = meal_items.meal_log_id
      and meal.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.meal_logs meal
    where meal.id = meal_items.meal_log_id
      and meal.user_id = auth.uid()
  )
);

create policy "Users can access their own water logs"
on public.water_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can access their own sleep logs"
on public.sleep_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can access their own mood logs"
on public.mood_logs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can access their own daily targets"
on public.daily_targets
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can access their own health metrics"
on public.health_metrics
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_workout_sessions_user_started
on public.workout_sessions(user_id, started_at desc);

create index if not exists idx_workout_sessions_active_user_started
on public.workout_sessions(user_id, started_at desc)
where is_deleted = false;

create index if not exists idx_workout_sets_session
on public.workout_sets(session_id);

create index if not exists idx_workout_sets_active_session
on public.workout_sets(session_id, set_number)
where is_deleted = false;

create index if not exists idx_body_measurements_user_measured
on public.body_measurements(user_id, measured_at desc);

create index if not exists idx_meal_logs_user_logged
on public.meal_logs(user_id, logged_at desc);

create index if not exists idx_water_logs_user_logged
on public.water_logs(user_id, logged_at desc);

create index if not exists idx_sleep_logs_user_start
on public.sleep_logs(user_id, sleep_start desc);

create index if not exists idx_mood_logs_user_logged
on public.mood_logs(user_id, logged_at desc);

create index if not exists idx_health_metrics_user_type_time
on public.health_metrics(user_id, metric_type, started_at desc);

insert into public.exercises (id, name, muscle_group, equipment, movement_type, difficulty, instructions)
values
  ('00000000-0000-0000-0000-000000000001', 'Bench Press', 'Chest', 'Barbell', 'Push', 'Intermediate', 'Lie on a flat bench, lower the bar under control to the chest, then press upward.'),
  ('00000000-0000-0000-0000-000000000002', 'Squat', 'Legs', 'Barbell', 'Squat', 'Intermediate', 'Brace your core, descend until your thighs are at least parallel, then drive upward.'),
  ('00000000-0000-0000-0000-000000000003', 'Deadlift', 'Back', 'Barbell', 'Hinge', 'Advanced', 'Hinge at the hips, keep the bar close, and stand tall without overextending.'),
  ('00000000-0000-0000-0000-000000000004', 'Pull-Up', 'Back', 'Bodyweight', 'Pull', 'Intermediate', 'Pull your chest toward the bar while keeping your core engaged.'),
  ('00000000-0000-0000-0000-000000000005', 'Overhead Press', 'Shoulders', 'Barbell', 'Push', 'Intermediate', 'Press the bar overhead while keeping ribs down and core tight.'),
  ('00000000-0000-0000-0000-000000000006', 'Dumbbell Row', 'Back', 'Dumbbell', 'Pull', 'Beginner', 'Support your torso and row the dumbbell toward your hip.'),
  ('00000000-0000-0000-0000-000000000007', 'Romanian Deadlift', 'Hamstrings', 'Barbell', 'Hinge', 'Intermediate', 'Push hips back with a soft knee bend and feel a hamstring stretch.'),
  ('00000000-0000-0000-0000-000000000008', 'Push-Up', 'Chest', 'Bodyweight', 'Push', 'Beginner', 'Maintain a straight line from head to heels and lower under control.')
on conflict (id) do nothing;
