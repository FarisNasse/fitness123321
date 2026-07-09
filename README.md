# All-In-One Fitness App

Initial implementation scaffold for a cross-platform fitness app covering workouts, nutrition, wellness, and progress tracking.

This patch starts the app as an Expo React Native + TypeScript project with:

- Expo Router navigation
- Supabase client setup
- Supabase SQL migration for the first data model
- Local SQLite setup for offline-first workout, nutrition, wellness, and body-measurement logging
- Reusable UI primitives
- Starter screens for dashboard, workouts, nutrition, wellness, progress, auth, and onboarding
- Initial workout session service

## MVP direction

The first vertical slice should be:

1. Sign in / sign up
2. Complete onboarding
3. Browse exercise library
4. Start a workout
5. Add sets/reps/weight
6. Complete workout
7. Show workout history
8. Update dashboard totals
9. Sync local data to Supabase

Do not start with AI, wearables, social features, or marketplace features. Those should come after the core logging loop works.

## Setup

```bash
npm install
npm run check:exercises
npx expo start -c
```

The exercise library uses local seeded data by default, so you do not need a
Supabase project just to run and test the workout screen from the terminal.


## Workout reviewer docs

The gym-use workflow now has short reviewer-facing docs so the feature can be understood without reading every source file:

- [`docs/workout-local-first-architecture.md`](docs/workout-local-first-architecture.md) explains the local-first data flow, local tables, sync behavior, and clean-checkout path.
- [`docs/workout-recommendation-logic.md`](docs/workout-recommendation-logic.md) explains smart defaults and next-time progression guidance in plain language.
- [`docs/workout-demo-script.md`](docs/workout-demo-script.md) gives a short script for demoing the main workout flow.
- [`docs/live-workout-ui-ux-research-diagnosis.md`](docs/live-workout-ui-ux-research-diagnosis.md) records the research-grounded live workout critique and definition of done that drove the focused logger redesign.

## Optional Supabase setup

Supabase is only needed once you want cloud auth/sync. Fill in `.env` and set
`EXPO_PUBLIC_EXERCISE_SOURCE=supabase` only when you intentionally want the
exercise library to read from Supabase instead of the local seed file.

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_EXERCISE_SOURCE=supabase
```

Wellness check-ins are local by default. To mirror dated sleep, mood, energy,
stress, and manual steps to the existing `sleep_logs` and `mood_logs` tables,
apply all Supabase migrations and set:

```bash
EXPO_PUBLIC_WELLNESS_SYNC_SOURCE=supabase
```

The Wellness tab accepts bedtime and wake time in 24-hour `HH:MM` format. A
wake time earlier than bedtime is treated as the following morning. Saving a
check-in updates the dashboard step card immediately and the local record
survives app reloads without requiring HealthKit, Health Connect, or a wearable.

The Progress tab stores weight and optional body-fat, waist, hips, chest, arm,
and thigh measurements locally. Weight is entered in pounds and circumference
values in inches; records are converted to the existing Supabase
`body_measurements` model (`weight_kg` and centimeter fields). Empty accounts
show no fabricated progress data. To enable authenticated cloud mirroring, set:

```bash
EXPO_PUBLIC_BODY_MEASUREMENT_SYNC_SOURCE=supabase
```

When enabled, the app pushes pending local measurements and refreshes the signed-in
user's remote history when the Progress tab opens. Supabase row-level security
continues to restrict `body_measurements` to `auth.uid() = user_id`.

Then run the migrations with the Supabase CLI or your preferred database
workflow.

## App structure

```txt
app/
  (auth)/
  (onboarding)/
  (tabs)/
src/
  components/
  features/
  lib/
  types/
supabase/
  migrations/
```

## Current screens

- `/` redirects to the main dashboard
- `/login`
- `/register`
- `/onboarding`
- `/dashboard`
- `/workouts`
- `/nutrition`
- `/wellness`
- `/progress`

## Notes

This is intentionally a buildable foundation rather than a complete app. The next patch should implement the full workout logging flow:

- Exercise list screen
- Start workout session action
- Live workout session screen
- Add set / edit set
- Complete workout
- Workout history
- Local-to-cloud sync
