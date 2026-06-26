# Train Tab UX GitHub roadmap

This document maps the Train Tab UX Simplification & Exercise Browser plan into GitHub milestones and implementation issues.

The goal is to keep GitHub useful: a few real milestones, a small set of focused issues, and enough task detail that a contributor can implement each slice without rereading the entire planning document.

## How to preview the GitHub changes

From the repo root:

```bash
node scripts/github/create-train-tab-ux-issues.mjs
```

That prints the milestones and issues without changing GitHub.

## How to apply the GitHub changes

After reviewing the dry run:

```bash
node scripts/github/create-train-tab-ux-issues.mjs --apply
```

The script uses the GitHub CLI and defaults to `FarisNasse/fitness123321`.

To target another fork or repo:

```bash
node scripts/github/create-train-tab-ux-issues.mjs --repo OWNER/REPO --apply
```

## What the script creates or updates

### Milestone 1 — Train Tab UX: Foundation & Browser Route

Purpose: lock the scope, verify the current state, and extract full exercise browsing to a dedicated route.

Issues:

- Train tab UX: extract Exercise Browser route

### Milestone 2 — Train Tab UX: Focused Workout Hub

Purpose: make the Train tab feel like a workout control center instead of a database/dashboard screen.

Issues:

- Train tab UX: simplify Train tab workout hub

### Milestone 3 — Train Tab UX: Exercise Browser Refinement

Purpose: make the reused exercise browser easier to scan and visually consistent across browser and picker contexts.

Issues:

- Train tab UX: move ExerciseLibrary filters into a sheet
- Train tab UX: theme ExerciseLibrary and picker surfaces

### Milestone 4 — Train Tab UX: Regression Coverage & Acceptance

Purpose: protect the refactor with fast tests and a manual acceptance pass.

Issues:

- Train tab UX: tests, copy hardening, and manual acceptance

## Guardrails

The GitHub issue plan intentionally avoids dependency churn. It should not add packages, change lockfiles, rewrite sync, or change database schema. The implementation work should stay focused on UI routes, copy, styling, and fast regression tests.

The live workout Add Exercise picker is a hard guardrail: it can be styled, but its selection behavior must not regress.
