import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('fitness.db');

export function initializeLocalDb() {
  db.execSync(`
    create table if not exists workout_sessions_local (
      local_id text primary key,
      server_id text,
      user_id text not null,
      name text not null,
      started_at text not null,
      completed_at text,
      duration_seconds integer,
      notes text,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create table if not exists workout_sets_local (
      local_id text primary key,
      server_id text,
      session_local_id text not null,
      exercise_id text not null,
      set_number integer not null,
      reps integer,
      weight real,
      completed integer default 0,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create table if not exists meal_logs_local (
      local_id text primary key,
      server_id text,
      user_id text not null,
      logged_at text not null,
      meal_type text not null,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create table if not exists meal_items_local (
      local_id text primary key,
      server_id text,
      meal_log_local_id text not null,
      food_id text,
      food_name text not null,
      quantity real not null,
      unit text,
      calories real not null default 0,
      protein_g real not null default 0,
      carbs_g real not null default 0,
      fat_g real not null default 0,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create table if not exists water_logs_local (
      local_id text primary key,
      server_id text,
      user_id text not null,
      logged_at text not null,
      amount_ml integer not null,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create table if not exists mood_logs_local (
      local_id text primary key,
      server_id text,
      user_id text not null,
      logged_at text not null,
      mood_score integer,
      stress_score integer,
      energy_score integer,
      notes text,
      sync_status text not null default 'pending',
      updated_at text not null
    );

    create index if not exists idx_workout_sets_session
    on workout_sets_local(session_local_id);

    create index if not exists idx_meal_items_meal
    on meal_items_local(meal_log_local_id);
  `);
}
