-- Harden the cloud contracts used by local-first synchronization.
-- This migration makes recency, tombstones, and date-level uniqueness explicit
-- so refresh/retry behavior is deterministic across devices.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.workout_sessions
  add column if not exists updated_at timestamptz not null default now();
alter table public.workout_sets
  add column if not exists updated_at timestamptz not null default now();
alter table public.workout_sets
  add column if not exists exercise_sort_order integer;

alter table public.body_measurements
  add column if not exists is_deleted boolean not null default false;
alter table public.body_measurements
  add column if not exists deleted_at timestamptz;
alter table public.body_measurements
  add column if not exists updated_at timestamptz not null default now();

alter table public.meal_logs
  add column if not exists is_deleted boolean not null default false;
alter table public.meal_logs
  add column if not exists deleted_at timestamptz;
alter table public.meal_logs
  add column if not exists updated_at timestamptz not null default now();

alter table public.meal_items
  add column if not exists is_deleted boolean not null default false;
alter table public.meal_items
  add column if not exists deleted_at timestamptz;
alter table public.meal_items
  add column if not exists updated_at timestamptz not null default now();

alter table public.water_logs
  add column if not exists is_deleted boolean not null default false;
alter table public.water_logs
  add column if not exists deleted_at timestamptz;
alter table public.water_logs
  add column if not exists updated_at timestamptz not null default now();

alter table public.sleep_logs
  add column if not exists is_deleted boolean not null default false;
alter table public.sleep_logs
  add column if not exists deleted_at timestamptz;
alter table public.sleep_logs
  add column if not exists updated_at timestamptz not null default now();

alter table public.mood_logs
  add column if not exists is_deleted boolean not null default false;
alter table public.mood_logs
  add column if not exists deleted_at timestamptz;
alter table public.mood_logs
  add column if not exists updated_at timestamptz not null default now();

-- Backfill deterministic date keys before enforcing one active wellness row per day.
update public.mood_logs
set check_in_date = logged_at::date
where check_in_date is null;

update public.sleep_logs
set check_in_date = sleep_start::date
where check_in_date is null;

-- Preserve older duplicates as tombstones rather than deleting history outright.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, check_in_date
           order by updated_at desc nulls last, logged_at desc, id desc
         ) as rank
  from public.mood_logs
  where check_in_date is not null and is_deleted = false
)
update public.mood_logs m
set is_deleted = true,
    deleted_at = coalesce(m.deleted_at, now()),
    updated_at = now()
from ranked r
where m.id = r.id and r.rank > 1;

with ranked as (
  select id,
         row_number() over (
           partition by user_id, check_in_date
           order by updated_at desc nulls last, sleep_start desc, id desc
         ) as rank
  from public.sleep_logs
  where check_in_date is not null and is_deleted = false
)
update public.sleep_logs s
set is_deleted = true,
    deleted_at = coalesce(s.deleted_at, now()),
    updated_at = now()
from ranked r
where s.id = r.id and r.rank > 1;

-- Daily targets are one row per account. Keep the newest row if legacy data has duplicates.
with ranked as (
  select id,
         row_number() over (
           partition by user_id
           order by updated_at desc nulls last, created_at desc, id desc
         ) as rank
  from public.daily_targets
)
delete from public.daily_targets d
using ranked r
where d.id = r.id and r.rank > 1;

create unique index if not exists uq_daily_targets_user
on public.daily_targets(user_id);

create unique index if not exists uq_mood_logs_active_user_date
on public.mood_logs(user_id, check_in_date)
where is_deleted = false and check_in_date is not null;

create unique index if not exists uq_sleep_logs_active_user_date
on public.sleep_logs(user_id, check_in_date)
where is_deleted = false and check_in_date is not null;

create index if not exists idx_workout_sessions_user_updated
on public.workout_sessions(user_id, updated_at desc);
create index if not exists idx_workout_sets_session_updated
on public.workout_sets(session_id, updated_at desc);
create index if not exists idx_meal_logs_user_updated
on public.meal_logs(user_id, updated_at desc);
create index if not exists idx_water_logs_user_updated
on public.water_logs(user_id, updated_at desc);
create index if not exists idx_mood_logs_user_updated
on public.mood_logs(user_id, updated_at desc);
create index if not exists idx_sleep_logs_user_updated
on public.sleep_logs(user_id, updated_at desc);
create index if not exists idx_body_measurements_user_updated
on public.body_measurements(user_id, updated_at desc);

-- Use a single trigger function so every server-side mutation advances recency.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'workout_sessions',
    'workout_sets',
    'body_measurements',
    'meal_logs',
    'meal_items',
    'water_logs',
    'sleep_logs',
    'mood_logs',
    'daily_targets'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end
$$;
