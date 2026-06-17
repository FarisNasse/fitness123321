# All-In-One Fitness App

Initial implementation scaffold for a cross-platform fitness app covering workouts, nutrition, wellness, and progress tracking.

This patch starts the app as an Expo React Native + TypeScript project with:

- Expo Router navigation
- Supabase client setup
- Supabase SQL migration for the first data model
- Local SQLite setup for offline-first workout logging
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

## Optional Supabase setup

Supabase is only needed once you want cloud auth/sync. Fill in `.env` and set
`EXPO_PUBLIC_EXERCISE_SOURCE=supabase` only when you intentionally want the
exercise library to read from Supabase instead of the local seed file.

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_EXERCISE_SOURCE=supabase
```

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
