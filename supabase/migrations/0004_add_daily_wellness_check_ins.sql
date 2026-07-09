-- Extend the existing wellness tables so one local-first daily check-in can be
-- mirrored to both mood_logs and sleep_logs, including a manual step total.

alter table public.mood_logs
  add column if not exists check_in_date date;

alter table public.mood_logs
  add column if not exists steps int check (steps >= 0);

update public.mood_logs
set check_in_date = logged_at::date
where check_in_date is null;

alter table public.sleep_logs
  add column if not exists check_in_date date;

update public.sleep_logs
set check_in_date = sleep_start::date
where check_in_date is null;

create index if not exists idx_mood_logs_user_check_in_date
on public.mood_logs(user_id, check_in_date desc);

create index if not exists idx_sleep_logs_user_check_in_date
on public.sleep_logs(user_id, check_in_date desc);
