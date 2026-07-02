# Main workout flow demo script

Use this script to show the workout feature from a clean checkout. It is written for a short reviewer demo and assumes local mode is acceptable.

## Setup

```bash
npm install
npm run test:all
npm start
```

Open the app and navigate to **Train**.

## Demo flow

1. **Show the Train tab**
   - Point out the `Local mode` badge.
   - Show the Quick start card and the exercise library.
   - If there are no sessions yet, point out the empty state explaining that completed workouts will appear here.

2. **Start a workout**
   - Tap **Start workout**.
   - The live workout screen should show a compact header, a rest strip when active, one active set logger, a compact exercise switcher, and a docked Log set action.

3. **Add an exercise**
   - Tap **Add exercise**.
   - Pick a seeded exercise from the library.
   - Point out the active exercise, last-set summary, current-set values, recent-set list, and docked Log set action.

4. **Log a set with one tap**
   - Use quick adjustments if needed.
   - Tap **Log set**.
   - Confirm the set appears immediately as the most recent set, the last-set summary updates, and the compact rest timer starts without interrupting the workout.

5. **Edit and delete edge cases**
   - Tap a logged set to open the edit sheet, change reps or weight, and save.
   - Delete a set from the edit sheet and show that destructive actions are no longer tiny row-level targets. Mention that the row is soft-deleted locally so sync can still send the deletion later.

6. **Finish the workout**
   - Open the finish sheet and optionally choose **Easy**, **Good**, or **Max** there, not in the middle of the live logging flow.
   - Tap **Finish workout**.
   - The completion alert should say the workout was saved locally and may include next-time guidance.

7. **Review history**
   - Back on **Train**, show the recent workout card.
   - Open it and show the grouped exercise/set summary.

8. **Repeat last workout**
   - Return to **Train**.
   - Tap **Repeat Last Workout**.
   - Show that a new live session opens with the previous exercises preloaded but without copying the old set rows.

## What to mention while demoing

- The workout loop is local-first: logging works without Supabase.
- Sync status is visible in plain language when cloud sync is enabled.
- Recommendation defaults come from recent local history first, then saved targets, then starter defaults.
- Empty and error states explain what happened instead of leaving blank workout cards.
- The key workout controls use wrapping rows/minimum widths, the live workout screen keeps only one logging workspace visible, and secondary work moves into sheets so it is easier to scan mid-set.
