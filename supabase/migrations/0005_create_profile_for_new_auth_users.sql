-- Create the RLS-owned profile row as soon as Supabase Auth creates a user.
-- This supports projects that require email confirmation: signUp can return no
-- session, but the user still has a profile waiting when they later sign in.

create or replace function public.handle_fitness_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_fitness_auth_user_created on auth.users;

create trigger on_fitness_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_fitness_auth_user();
