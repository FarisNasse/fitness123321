#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const REPO = 'FarisNasse/fitness123321';
const APPLY = process.argv.includes('--apply');
const OLD_ISSUES = Array.from({ length: 24 }, (_, index) => index + 18);

const supersededComment = [
  'Closing this as superseded by the cleaned-up workout roadmap.',
  '',
  'The previous plan created too many open issues and made the tracker harder to use.',
  'The replacement plan uses real GitHub milestones and a smaller set of focused implementation issues.',
].join('\n');

const roadmap = [
  {
    title: 'Gym-first workout flow',
    description: 'Make workout logging fast enough to use during a real gym session.',
    issues: [
      {
        title: 'Workout flow: repeat last workout and preload exercises',
        body: issueBody({
          milestone: 'Gym-first workout flow',
          goal: 'Let the user start a familiar workout without manually rebuilding it exercise by exercise.',
          tasks: [
            'Add a Repeat Last Workout action on the Workouts tab.',
            'Create a new local workout session from the most recent completed workout.',
            'Preserve exercise order from the previous workout.',
            'Preload each exercise into the live session screen.',
            'Show a useful empty state when no completed workout exists.',
          ],
          acceptance: [
            'A user can start a repeated workout in one action.',
            'The previous completed workout is not modified.',
            'The new session opens with exercises already present.',
          ],
        }),
      },
      {
        title: 'Workout flow: one-tap set logging with quick adjustments',
        body: issueBody({
          milestone: 'Gym-first workout flow',
          goal: 'Make the normal set-logging path one tap, while keeping manual editing available.',
          tasks: [
            'Add a large current-set card to the live workout screen.',
            'Show exercise name, set number, suggested reps, and suggested weight.',
            'Add a prominent Done button that logs the displayed values.',
            'Add quick adjustment controls for reps and weight.',
            'Keep the existing manual add/edit flow as the fallback path.',
          ],
          acceptance: [
            'A normal set can be logged without typing.',
            'Quick adjustments change the saved set values.',
            'The rest timer still starts after logging a set.',
          ],
        }),
      },
    ],
  },
  {
    title: 'Smart workout suggestions',
    description: 'Use workout history to suggest useful next steps without making the app feel complicated.',
    issues: [
      {
        title: 'Suggestions: store exercise targets and recent set defaults',
        body: issueBody({
          milestone: 'Smart workout suggestions',
          goal: 'Give each exercise sensible defaults for sets, rep ranges, increments, and recent values.',
          tasks: [
            'Add local storage for exercise target defaults.',
            'Track target sets, rep min, rep max, increment size, and deload percentage.',
            'Use recent history to prefill suggested set values.',
            'Fall back safely when no history exists.',
            'Keep target configuration optional for the user.',
          ],
          acceptance: [
            'Exercises with history use recent values as defaults.',
            'Exercises without history still get reasonable defaults.',
            'The user does not need to configure targets before logging a workout.',
          ],
        }),
      },
      {
        title: 'Suggestions: local progression engine and next-time guidance',
        body: issueBody({
          milestone: 'Smart workout suggestions',
          goal: 'Recommend whether to increase weight, repeat the same load, or deload using local workout history.',
          tasks: [
            'Add a local TypeScript progression service.',
            'Use rep-range based double progression as the main rule.',
            'Treat estimated 1RM as a secondary progress insight, not the main recommendation.',
            'Support optional Easy / Good / Max effort feedback.',
            'Show short plain-English reasons after workout completion.',
          ],
          acceptance: [
            'The recommendation engine works offline.',
            'Suggestions are understandable to a beginner.',
            'Unit tests cover increase, repeat, and deload cases.',
          ],
        }),
      },
    ],
  },
  {
    title: 'Offline data safety',
    description: 'Make workout data safe to edit, delete, and sync later.',
    issues: [
      {
        title: 'Offline safety: soft deletes for sessions and sets',
        body: issueBody({
          milestone: 'Offline data safety',
          goal: 'Replace hard deletes with soft deletes so offline deletion events can still sync later.',
          tasks: [
            'Add is_deleted and deleted_at fields for local workout sessions and sets.',
            'Add matching Supabase migration fields.',
            'Update deleteLocalWorkoutSet to mark rows as deleted instead of removing them.',
            'Hide deleted rows from normal live-session and history queries.',
            'Keep deleted pending rows available for sync.',
          ],
          acceptance: [
            'Deleted sets disappear from the UI immediately.',
            'Deleted rows are not permanently lost before sync.',
            'Existing local data continues to load safely.',
          ],
        }),
      },
      {
        title: 'Offline safety: resilient sync status and retry',
        body: issueBody({
          milestone: 'Offline data safety',
          goal: 'Make sync state visible and recoverable without blocking workout logging.',
          tasks: [
            'Sync soft-deleted sessions and sets to Supabase.',
            'Handle missing remote rows without crashing.',
            'Show Saved on device, Syncing, Synced, or Sync failed in plain language.',
            'Add a manual retry action for failed sync.',
            'Do not block local logging when remote sync fails.',
          ],
          acceptance: [
            'Offline changes eventually sync when possible.',
            'Failed sync can be retried manually.',
            'The UI makes it clear that local workout data is still saved.',
          ],
        }),
      },
    ],
  },
  {
    title: 'Project polish and demo readiness',
    description: 'Make the workout feature testable, explainable, and easy to demonstrate.',
    issues: [
      {
        title: 'Project quality: tests for gym-use workflows',
        body: issueBody({
          milestone: 'Project polish and demo readiness',
          goal: 'Protect the main workout workflow with focused regression tests.',
          tasks: [
            'Test repeating a workout creates a new session without modifying the old one.',
            'Test suggested defaults from recent history.',
            'Test one-tap Done logs the displayed values.',
            'Test quick adjustments change the saved set values.',
            'Include the coverage in npm run test:all.',
          ],
          acceptance: [
            'The main gym-use workflow has regression coverage.',
            'Tests remain fast enough for normal development.',
            'CI stays useful after the feature is added.',
          ],
        }),
      },
      {
        title: 'Project quality: docs, demo script, and empty states',
        body: issueBody({
          milestone: 'Project polish and demo readiness',
          goal: 'Make the feature feel complete to a reviewer and understandable from a clean checkout.',
          tasks: [
            'Improve empty, loading, and error states for workout screens.',
            'Document the local-first architecture.',
            'Document the recommendation logic in plain language.',
            'Add a short demo script for the main workout flow.',
            'Review mobile spacing for the key workout cards.',
          ],
          acceptance: [
            'The workout flow is easy to demo.',
            'A reviewer can understand the design without reading every source file.',
            'The app does not show confusing blank states in normal edge cases.',
          ],
        }),
      },
    ],
  },
];

function issueBody({ milestone, goal, tasks, acceptance }) {
  return [
    `Milestone: ${milestone}`,
    '',
    '## Goal',
    goal,
    '',
    '## Tasks',
    ...tasks.map((task) => `- [ ] ${task}`),
    '',
    '## Acceptance criteria',
    ...acceptance.map((item) => `- [ ] ${item}`),
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

function listOpenIssues() {
  try {
    return apiJson([`repos/${REPO}/issues?state=open&per_page=100`, '--paginate']);
  } catch (error) {
    console.error(`Could not read open issues for ${REPO}.`);
    throw error;
  }
}

function listMilestones() {
  try {
    return apiJson([`repos/${REPO}/milestones?state=open&per_page=100`, '--paginate']);
  } catch (error) {
    console.error(`Could not read milestones for ${REPO}.`);
    throw error;
  }
}

function printPlan() {
  console.log('Workout issue cleanup plan');
  console.log('===========================');
  console.log('');
  console.log(`Repository: ${REPO}`);
  console.log(`Mode: ${APPLY ? 'APPLY changes' : 'dry run only'}`);
  console.log('');
  console.log(`Close noisy issues: ${OLD_ISSUES.map((issue) => `#${issue}`).join(', ')}`);
  console.log('');
  for (const milestone of roadmap) {
    console.log(`Milestone: ${milestone.title}`);
    for (const issue of milestone.issues) {
      console.log(`  - ${issue.title}`);
    }
    console.log('');
  }
  if (!APPLY) {
    console.log('No GitHub changes were made. Re-run with --apply to update the issue tracker.');
  }
}

function closeOldIssues() {
  for (const number of OLD_ISSUES) {
    try {
      runGh([
        'issue',
        'close',
        String(number),
        '--repo',
        REPO,
        '--reason',
        'not planned',
        '--comment',
        supersededComment,
      ], { inherit: true });
    } catch {
      console.warn(`Could not close #${number}. It may already be closed or unavailable.`);
    }
  }
}

function ensureMilestones() {
  const existing = new Map(listMilestones().map((milestone) => [milestone.title, milestone]));
  const result = new Map();

  for (const milestone of roadmap) {
    const current = existing.get(milestone.title);
    if (current) {
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
  }

  return result;
}

function createOrUpdateIssues(milestoneNumbers) {
  const openIssues = listOpenIssues();
  const openByTitle = new Map(openIssues.map((issue) => [issue.title, issue]));

  for (const milestone of roadmap) {
    const milestoneNumber = milestoneNumbers.get(milestone.title);

    for (const issue of milestone.issues) {
      const current = openByTitle.get(issue.title);
      if (current) {
        apiJson([
          '-X',
          'PATCH',
          `repos/${REPO}/issues/${current.number}`,
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
closeOldIssues();
const milestoneNumbers = ensureMilestones();
createOrUpdateIssues(milestoneNumbers);

console.log('');
console.log('Workout roadmap cleanup complete.');
