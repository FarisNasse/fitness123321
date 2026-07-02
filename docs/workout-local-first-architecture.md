# Workout local-first architecture

This workout flow is designed so a reviewer can clone the repo, run the app, and demo the gym loop without creating Supabase tables first. The phone/browser local database is the source of truth for active logging. Supabase is an optional sync target that can be enabled later.

## Core idea

1. The UI writes workout sessions, selected exercises, exercise targets, and sets to local SQLite first.
2. The UI reads the same local tables back for the live session, recent workouts, history, repeat-last-workout, and next-time suggestions.
3. Cloud sync runs after local writes when `USE_REMOTE_WORKOUT_SYNC` is enabled, but a sync failure never blocks logging.
4. The user sees plain-language sync labels such as `Saved on device`, `Syncing`, `Synced`, and `Sync failed`.

## Main files

| File | Responsibility |
| --- | --- |
| `app/(tabs)/workouts.tsx` | Train tab, quick start, repeat-last-workout, exercise library, recent workout history, sync retry affordance. |
| `app/workout/session/[id].tsx` | Small live-session route shell for loading/error states and handoff into the live workout controller/view. |
| `src/features/workouts/live/useLiveWorkoutController.ts` | Live workout controller: session/exercise/set loading, per-exercise drafts, logging, target persistence, edit/delete, finish, rest state, and sync orchestration. |
| `src/features/workouts/live/liveWorkoutReducer.ts` | Explicit state transitions for per-exercise drafts, dirty-draft protection, rest, sheets, and save notices. |
| `src/features/workouts/live/components/LiveWorkoutScreenView.tsx` | Focused workout logging instrument: compact header, exercise switcher, active set logger, recent sets, docked action bar, and sheets. |
| `app/workout/history/[id].tsx` | Completed workout summary grouped by exercise. |
| `src/features/workouts/workout-service.ts` | Local write/read helpers, repeat-last-workout, smart defaults, progression summary, sync orchestration. |
| `src/features/workouts/progression-service.ts` | Pure recommendation rules for increase/repeat/deload decisions. |
| `src/lib/local-db.ts` | Native SQLite adapter, web local-storage adapter, local table schema, and web SQL shims used by tests/dev. |
| `supabase/migrations/` | Remote schema changes for eventual cloud persistence. |

## Local tables used by the workout flow

| Local table | Purpose |
| --- | --- |
| `workout_sessions_local` | One row per workout session. Tracks name, start/completion time, duration, soft-delete fields, sync status, and optional remote id. |
| `workout_session_exercises_local` | Ordered list of exercises selected for a session. This lets repeated workouts preload exercise cards even before new sets are logged. |
| `workout_sets_local` | One row per logged set. Tracks exercise id, set number, reps, weight, soft-delete fields, sync status, and optional remote id. |
| `exercise_targets_local` | Optional per-exercise target settings for set count, rep range, increment size, and deload percentage. |

## Write flow

### Start workout

`app/(tabs)/workouts.tsx` calls `getWorkoutOwnerUserId()` and then `createLocalWorkoutSession(userId, 'Quick workout')`. The returned `local_id` is used for navigation: `/workout/session/[id]`.

### Pick exercise

The live workout feature opens `ExerciseLibrary` inside an exercise-picker sheet. When an exercise is chosen, the controller stores it in `workout_session_exercises_local` through `addLocalWorkoutSessionExercise()`. This makes the selected exercise stable even if there are not any sets yet, and immediately returns the user to the focused logger.

### Log set

The active exercise workspace has one primary docked `Log set` action. It routes through the controller `addSet()` command, which parses the visible per-exercise draft and calls `addLocalWorkoutSet()` with the current session id and active exercise id. The service writes the set locally, marks the session `pending`, and the UI refreshes from local storage. Inactive exercise chips only switch the active exercise; they do not write sets from shared draft state.

### Edit or delete set

`updateLocalWorkoutSet()` rewrites reps/weight and marks the set/session pending. Logged set rows open an edit sheet; deletion lives in that sheet instead of a small inline row target. `deleteLocalWorkoutSet()` performs a soft delete by setting `is_deleted` and `deleted_at`, then the normal read helpers hide the row from the UI. The tombstone remains available for sync.

### Finish workout

`completeLocalWorkoutSession()` sets `completed_at`, calculates duration, and marks the session pending. Effort feedback is collected in the finish sheet instead of as a mid-workout card. The controller then builds a small next-time summary from local history and returns to the Train tab.

## Read flow

The screens read local data directly through `workout-service.ts`:

- Train tab: `getCompletedWorkoutSessions(4)` and `getLocalWorkoutSets(session.local_id)`.
- Live session: `getLocalWorkoutSession(sessionId)`, `getLocalWorkoutSessionExercises(sessionId)`, and `getLocalWorkoutSets(sessionId)`.
- History detail: `getLocalWorkoutSession(sessionId)` and `getLocalWorkoutSets(sessionId)`.
- Repeat-last-workout: `repeatLastCompletedWorkout(userId)` finds the latest completed session, creates a new local session, copies the selected exercise order, and does **not** copy old set rows.

## Sync model

Sync is intentionally secondary to logging. When remote sync is off, the app still works as a complete local demo. When remote sync is on:

1. Local changes are marked `pending`.
2. `syncPendingWorkoutSessions()` gathers pending or failed sessions and sets.
3. Active rows are upserted to Supabase.
4. Soft-deleted rows are upserted as remote tombstones instead of hard deleted.
5. Missing remote rows are recreated or tombstoned so retries stay idempotent.
6. Rows become `synced` only after the remote write succeeds; otherwise they become `failed` and can be retried from the Train tab.

## Clean checkout reviewer path

A reviewer does not need Supabase for the main workout demo:

```bash
npm install
npm run test:all
npm start
```

Then open the app, go to **Train**, start a workout, add an exercise, adjust reps/weight in the active set logger, press **Log set**, finish from the finish sheet, and confirm the workout appears in recent history.
