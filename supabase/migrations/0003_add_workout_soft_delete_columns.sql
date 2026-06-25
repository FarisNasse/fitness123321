-- Add soft-delete tombstone fields for offline workout deletion sync.
-- These columns let clients preserve local deletion events and replay them later
-- without permanently deleting remote rows.

alter table public.workout_sessions
  add column if not exists is_deleted boolean not null default false;

alter table public.workout_sessions
  add column if not exists deleted_at timestamptz;

alter table public.workout_sets
  add column if not exists is_deleted boolean not null default false;

alter table public.workout_sets
  add column if not exists deleted_at timestamptz;

create index if not exists idx_workout_sessions_active_user_started
on public.workout_sessions(user_id, started_at desc)
where is_deleted = false;

create index if not exists idx_workout_sets_active_session
on public.workout_sets(session_id, set_number)
where is_deleted = false;
