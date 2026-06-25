# Workout roadmap cleanup

The workout roadmap should be organized around a few real GitHub milestones, not a long issue list full of tiny tickets.

## Why this exists

The previous issue plan created too much tracker noise: five fake milestone issues plus many small issues. That made the open issue list harder to read and harder to prioritize.

This cleanup replaces that with four real milestones and eight focused implementation issues.

## Proposed milestones

### 1. Gym-first workout flow

Goal: make the app usable during an actual workout without turning logging into busywork.

Issues:

- Workout flow: repeat last workout and preload exercises
- Workout flow: one-tap set logging with quick adjustments

### 2. Smart workout suggestions

Goal: use workout history to suggest what the user should do next without requiring complex setup.

Issues:

- Suggestions: store exercise targets and recent set defaults
- Suggestions: local progression engine and next-time guidance

### 3. Offline data safety

Goal: protect workout data when the user edits, deletes, or syncs later.

Issues:

- Offline safety: soft deletes for sessions and sets
- Offline safety: resilient sync status and retry

### 4. Project polish and demo readiness

Goal: make the feature testable, explainable, and easy to demo.

Issues:

- Project quality: tests for gym-use workflows
- Project quality: docs, demo script, and empty states

## How to apply this cleanup to GitHub

From the repo root:

```bash
npm run issues:workout-roadmap
```

That shows the plan without changing GitHub.

To actually update GitHub:

```bash
npm run issues:workout-roadmap -- --apply
```

The script will:

1. Close the noisy planning issues `#18` through `#41` as superseded.
2. Create real GitHub milestones if they do not already exist.
3. Create or update eight consolidated issues and assign them to those milestones.

The result should be a clean open issue list with only the high-value implementation work visible.
