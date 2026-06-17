-- Keep existing Supabase projects compatible with the exercise-library screen.
-- 0001 uses CREATE TABLE IF NOT EXISTS, so older databases that already had
-- public.exercises may be missing columns added later in the app code.

alter table public.exercises
  add column if not exists equipment text,
  add column if not exists movement_type text,
  add column if not exists difficulty text,
  add column if not exists instructions text,
  add column if not exists video_url text,
  add column if not exists created_at timestamptz default now();

alter table public.exercises enable row level security;

drop policy if exists "Authenticated users can read exercises" on public.exercises;
drop policy if exists "Anyone can read exercises" on public.exercises;

-- Exercises are static catalog data, not user-owned data. Allowing anonymous
-- reads lets the workouts tab render the library before a user starts logging.
create policy "Anyone can read exercises"
on public.exercises
for select
to anon, authenticated
using (true);

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
on conflict (id) do update set
  name = excluded.name,
  muscle_group = excluded.muscle_group,
  equipment = excluded.equipment,
  movement_type = excluded.movement_type,
  difficulty = excluded.difficulty,
  instructions = excluded.instructions;
