#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const DEFAULT_REPO = process.env.GITHUB_REPOSITORY || 'FarisNasse/fitness123321';
const APPLY = process.argv.includes('--apply');
const REPO = getArgValue('--repo') || DEFAULT_REPO;

const roadmap = [
  {
    title: 'Train Tab UX: Foundation & Browser Route',
    description: 'Scope the Train tab UX refactor and extract full exercise browsing to a dedicated route.',
    issues: [
      {
        title: 'Train tab UX: extract Exercise Browser route',
        body: issueBody({
          planMilestones: [
            'Milestone 0 — Scope Lock & Baseline Verification',
            'Milestone 1 — Dedicated Exercise Browser Route',
          ],
          goal: 'Confirm the current Train tab problem state, then move full exercise browsing to its own route without changing live workout picker behavior.',
          files: [
            'Add `app/workout/exercises.tsx`',
            'Update `app/_layout.tsx`',
            'Reuse `src/features/workouts/ExerciseLibrary.tsx`',
            'Reuse `src/components/Screen.tsx`',
          ],
          tasks: [
            'Confirm the Train tab currently renders the inline exercise library before changing files.',
            'Confirm the live workout Add Exercise picker uses `ExerciseLibrary` with `onSelect`.',
            'Confirm `npm run test:all` passes, or document the current failing baseline before this refactor.',
            'Create `app/workout/exercises.tsx` and render `<ExerciseLibrary scrollMode="page" />` inside `<Screen>`.',
            'Register `workout/exercises` in `app/_layout.tsx` with header styling consistent with the existing workout stack screens.',
            'Avoid duplicating exercise library or exercise selection logic.',
            'Do not touch dependencies, lockfiles, local database schema, Supabase schema, or sync architecture.',
          ],
          acceptance: [
            'The implementer can summarize the before/after behavior in one sentence.',
            '`/workout/exercises` opens a full-page exercise browser.',
            'The Train tab can route to the exercise browser.',
            'Tapping Add exercise in a live workout still opens the picker.',
            'Selecting an exercise in picker mode still adds it to the session, closes the picker, and makes it active.',
            'Workout set logging behavior remains unchanged.',
          ],
        }),
      },
    ],
  },
  {
    title: 'Train Tab UX: Focused Workout Hub',
    description: 'Turn the Train tab into a simple workout launch and review surface with user-facing language.',
    issues: [
      {
        title: 'Train tab UX: simplify Train tab workout hub',
        body: issueBody({
          planMilestones: [
            'Milestone 2 — Train Tab Simplification',
            'Milestone 5 — Product Copy & State Language',
          ],
          goal: 'Remove the full library from the Train tab and make Start workout the obvious primary action.',
          files: [
            'Update `app/(tabs)/workouts.tsx`',
            'Preserve per-workout sync retry/status UI in history cards',
          ],
          tasks: [
            'Remove the inline `<ExerciseLibrary scrollMode="page" />` card from the Train tab.',
            'Remove the now-unused `ExerciseLibrary` import from `app/(tabs)/workouts.tsx`.',
            'Add a `browseExercises()` helper that routes to `/workout/exercises`.',
            'Add a secondary `Browse exercises` outline button in the quick actions area.',
            'Rename `Quick start` to `Quick actions` and remove the long descriptive paragraph below the card title.',
            'Keep `Start workout` as the first and strongest action.',
            'Render `Repeat Last Workout` only when `recentSessions.length > 0`.',
            'Remove the large `Nothing to repeat yet` empty state while keeping the internal no-history guard in `repeatLastWorkout()`.',
            'Replace developer metrics with `Recent sessions` and `Sets logged`.',
            'Use the Train subtitle: `Start a workout, log your sets, and review what you completed.`',
            'Remove normal Train tab references to Supabase, local mode, cloud sync, remote database, demo setup, and local persistence as a technical feature.',
          ],
          acceptance: [
            'The Train tab no longer renders the full exercise library.',
            'The Train tab has one obvious primary action: Start workout.',
            'Browse exercises is available but visually secondary.',
            'Repeat Last Workout appears only when it can be used.',
            'The top of the page does not mention infrastructure or backend state.',
            'Recent metrics are understandable to a normal fitness user.',
            'Per-workout sync retry UI in history cards is preserved.',
          ],
        }),
      },
    ],
  },
  {
    title: 'Train Tab UX: Exercise Browser Refinement',
    description: 'Improve ExerciseLibrary information architecture and dark-mode visual consistency.',
    issues: [
      {
        title: 'Train tab UX: move ExerciseLibrary filters into a sheet',
        body: issueBody({
          planMilestones: [
            'Milestone 3 — Exercise Library Information Architecture',
          ],
          goal: 'Keep search visible but move structured filters into a modal sheet so browsing is easier to scan.',
          files: [
            'Update `src/features/workouts/ExerciseLibrary.tsx`',
          ],
          tasks: [
            'Keep the search input visible with placeholder copy like `Search exercise, muscle, or equipment`.',
            'Add `isFilterSheetOpen` state for a simple React Native `Modal` sheet.',
            'Add `activeFilterCount` derived from structured filters only, not search text.',
            'Replace always-visible filter groups with a summary row that shows visible exercise count and a `Filter` / `Filter (N)` button.',
            'Keep a visible Clear action when search text or filters are active.',
            'Build a modal filter sheet with translucent overlay, rounded sheet container, header, optional `Clear all`, wrapped filter chips, and a primary `Show exercises` footer button.',
            'Support close paths for tapping outside, tapping Show exercises, and Android back via `onRequestClose`.',
            'Keep the existing exercise detail modal separate from the filter modal.',
            'Ensure selecting an exercise still opens details and picker mode still calls `onSelect?.(exercise)`.',
          ],
          acceptance: [
            'Filter groups no longer occupy the main ExerciseLibrary page by default.',
            'Users can tell how many exercises are visible.',
            'Active structured filters are reflected in the Filter button label.',
            'Clear all removes structured filters and search when using the global clear action.',
            'Exercise details still open and close as before.',
            'Live picker mode still works.',
          ],
        }),
      },
      {
        title: 'Train tab UX: theme ExerciseLibrary and picker surfaces',
        body: issueBody({
          planMilestones: [
            'Milestone 4 — Theme & Styling Cleanup',
          ],
          goal: 'Remove hardcoded light-mode styling from ExerciseLibrary so browser and picker surfaces fit the rest of the app.',
          files: [
            'Update `src/features/workouts/ExerciseLibrary.tsx`',
            'Possibly update `app/workout/session/[id].tsx` if the picker wrapper uses a hardcoded white background',
          ],
          tasks: [
            'Refactor `ExerciseBadge` and `FilterChip` away from hardcoded hex styles where practical.',
            'Use app tokens such as `bg-primary/15`, `text-primary`, `border-primary`, `bg-base-100`, `bg-base-200`, `bg-base-300`, `text-base-content`, `text-base-muted`, `rounded-pill`, `rounded-card`, and `rounded-input`.',
            'Improve exercise card touch targets with comfortable padding, clear hierarchy, muted metadata, rounded containers, and pressed feedback.',
            'Update the search input with `rounded-input`, `border border-base-300`, `bg-base-100`, `px-4 py-3`, and a readable placeholder color.',
            'Audit the live picker wrapper and update hardcoded white modal surfaces to theme-aware tokens or values if needed.',
          ],
          acceptance: [
            'Exercise browser does not look like a white web card pasted into a dark app.',
            'Filter chips have clear active and inactive states.',
            'Exercise cards provide visible pressed feedback.',
            'Text remains legible in dark mode.',
            'The live workout picker visually matches the rest of the app.',
          ],
        }),
      },
    ],
  },
  {
    title: 'Train Tab UX: Regression Coverage & Acceptance',
    description: 'Protect the Train tab UX refactor with fast tests, copy checks, and a phone-focused manual pass.',
    issues: [
      {
        title: 'Train tab UX: tests, copy hardening, and manual acceptance',
        body: issueBody({
          planMilestones: [
            'Milestone 5 — Product Copy & State Language',
            'Milestone 6 — Automated Test Coverage',
            'Milestone 7 — Manual UX Acceptance Pass',
          ],
          goal: 'Make sure the simplified Train tab, dedicated exercise browser, filter sheet, and user-facing copy stay protected by the existing fast test suite.',
          files: [
            'Update `tests/screens-and-config.test.mjs`',
            'Add or update `tests/train-tab-ux.test.mjs`',
            'Update existing tests only where assertions are tied to old copy',
          ],
          tasks: [
            'Add route coverage for `app/workout/exercises.tsx` and the `workout/exercises` Stack screen in `app/_layout.tsx`.',
            'Assert `app/(tabs)/workouts.tsx` does not import or render `ExerciseLibrary` inline.',
            'Assert the Train tab contains `Browse exercises`, routes to `/workout/exercises`, and contains `Quick actions` instead of `Quick start`.',
            'Assert the Train tab does not contain `Local mode`, `Cloud sync on`, `Supabase`, `remote database`, or a `Sync` mini stat.',
            'Assert `Repeat Last Workout` is conditionally rendered behind `recentSessions.length > 0` and the old `Nothing to repeat yet` empty state is gone.',
            'Assert the internal `repeatLastWorkout()` guard still handles the no-history case.',
            'Assert `ExerciseLibrary` has `isFilterSheetOpen`, calculates `activeFilterCount`, uses a filter `Modal`, and still has the selected exercise detail modal.',
            'Assert picker mode still calls `onSelect?.(exercise)`.',
            'Add copy safety checks for `npm run check:exercises`, `seed file`, `Supabase`, `remote database`, `Local mode`, and `Cloud sync on` on normal Train and ExerciseLibrary surfaces.',
            'Ensure all new coverage runs through `npm run test:all` without adding slow browser or device tests.',
            'Perform the manual UX pass for Train tab, Exercise Browser, live workout picker, and dark mode visual polish.',
          ],
          acceptance: [
            'Test coverage prevents the inline exercise library from returning to the Train tab.',
            'Test coverage prevents developer copy from returning to the main workout UI.',
            'Test coverage confirms the new route exists.',
            'Test coverage confirms live picker behavior remains wired.',
            '`npm run test:all` remains the single validation command.',
            'A new user can understand the Train tab in under five seconds.',
            'Exercise browsing feels available but not intrusive.',
            'Filtering feels optional, not mandatory.',
            'The workout logging flow remains fast.',
            'No obvious dark-mode mismatches remain.',
          ],
        }),
      },
    ],
  },
];

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    console.error(`Missing value for ${flag}.`);
    process.exit(1);
  }

  return value;
}

function issueBody({ planMilestones, goal, files, tasks, acceptance }) {
  return [
    `Plan milestones: ${planMilestones.join('; ')}`,
    '',
    '## Goal',
    goal,
    '',
    '## Files',
    ...files.map((file) => `- ${file}`),
    '',
    '## Tasks',
    ...tasks.map((task) => `- [ ] ${task}`),
    '',
    '## Acceptance criteria',
    ...acceptance.map((item) => `- [ ] ${item}`),
    '',
    '## Guardrails',
    '- [ ] Do not add, remove, or upgrade packages.',
    '- [ ] Do not change `package-lock.json` for this UX milestone.',
    '- [ ] Do not change Supabase schema, local database schema, or workout sync architecture.',
    '- [ ] Preserve live workout Add Exercise picker behavior.',
  ].join('\n');
}

function runGh(args, options = {}) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
}

function ensureGhAvailable() {
  try {
    runGh(['--version']);
  } catch {
    console.error('GitHub CLI is required. Install gh and run gh auth login first.');
    process.exit(1);
  }
}

function apiJson(args) {
  return JSON.parse(runGh(['api', ...args]));
}

function listIssues() {
  try {
    return apiJson([`repos/${REPO}/issues?state=all&per_page=100`, '--paginate']).filter(
      (issue) => !issue.pull_request
    );
  } catch (error) {
    console.error(`Could not read issues for ${REPO}.`);
    throw error;
  }
}

function listMilestones() {
  try {
    return apiJson([`repos/${REPO}/milestones?state=all&per_page=100`, '--paginate']);
  } catch (error) {
    console.error(`Could not read milestones for ${REPO}.`);
    throw error;
  }
}

function printPlan() {
  console.log('Train Tab UX GitHub issue plan');
  console.log('==================================');
  console.log('');
  console.log(`Repository: ${REPO}`);
  console.log(`Mode: ${APPLY ? 'APPLY changes' : 'dry run only'}`);
  console.log('');

  for (const milestone of roadmap) {
    console.log(`Milestone: ${milestone.title}`);
    console.log(`  ${milestone.description}`);
    for (const issue of milestone.issues) {
      console.log(`  - ${issue.title}`);
    }
    console.log('');
  }

  if (!APPLY) {
    console.log('No GitHub changes were made. Re-run with --apply to update the issue tracker.');
  }
}

function ensureMilestones() {
  const existing = new Map(listMilestones().map((milestone) => [milestone.title, milestone]));
  const result = new Map();

  for (const milestone of roadmap) {
    const current = existing.get(milestone.title);
    if (current) {
      if (current.state !== 'open') {
        apiJson([
          '-X',
          'PATCH',
          `repos/${REPO}/milestones/${current.number}`,
          '-f',
          'state=open',
          '-f',
          `description=${milestone.description}`,
        ]);
        console.log(`Reopened milestone: ${milestone.title}`);
      } else if (current.description !== milestone.description) {
        apiJson([
          '-X',
          'PATCH',
          `repos/${REPO}/milestones/${current.number}`,
          '-f',
          `description=${milestone.description}`,
        ]);
        console.log(`Updated milestone: ${milestone.title}`);
      }
      result.set(milestone.title, current.number);
      continue;
    }

    const created = apiJson([
      '-X',
      'POST',
      `repos/${REPO}/milestones`,
      '-f',
      `title=${milestone.title}`,
      '-f',
      `description=${milestone.description}`,
    ]);
    result.set(milestone.title, created.number);
    console.log(`Created milestone: ${milestone.title}`);
  }

  return result;
}

function createOrUpdateIssues(milestoneNumbers) {
  const issues = listIssues();
  const issuesByTitle = new Map(issues.map((issue) => [issue.title, issue]));

  for (const milestone of roadmap) {
    const milestoneNumber = milestoneNumbers.get(milestone.title);

    for (const issue of milestone.issues) {
      const current = issuesByTitle.get(issue.title);
      if (current) {
        apiJson([
          '-X',
          'PATCH',
          `repos/${REPO}/issues/${current.number}`,
          '-f',
          'state=open',
          '-f',
          `body=${issue.body}`,
          '-F',
          `milestone=${milestoneNumber}`,
        ]);
        console.log(`Updated #${current.number}: ${issue.title}`);
        continue;
      }

      const created = apiJson([
        '-X',
        'POST',
        `repos/${REPO}/issues`,
        '-f',
        `title=${issue.title}`,
        '-f',
        `body=${issue.body}`,
        '-F',
        `milestone=${milestoneNumber}`,
      ]);
      console.log(`Created #${created.number}: ${issue.title}`);
    }
  }
}

printPlan();

if (!APPLY) {
  process.exit(0);
}

ensureGhAvailable();
const milestoneNumbers = ensureMilestones();
createOrUpdateIssues(milestoneNumbers);

console.log('');
console.log('Train Tab UX GitHub issue setup complete.');
