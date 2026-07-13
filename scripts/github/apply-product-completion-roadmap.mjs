#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  definitionOfDone,
  productCompletionRoadmap,
  repositoryDefault,
  roadmapLabels,
} from './product-completion-roadmap.mjs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const REPOSITORY = readOption('--repo') ?? process.env.GITHUB_REPOSITORY ?? repositoryDefault;
const issueCount = productCompletionRoadmap.reduce(
  (total, milestone) => total + milestone.issues.length,
  0
);

function readOption(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;

  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function markerFor(issueId) {
  return `<!-- fitness-product-roadmap:${issueId} -->`;
}

export function renderIssueBody(issue, milestone) {
  const sections = [
    markerFor(issue.id),
    `**Priority:** ${issue.priority}`,
    `**Milestone:** ${milestone.title}`,
    '',
    '## Goal',
    issue.goal,
    '',
    '## Implementation checklist',
    ...issue.tasks.map((task) => `- [ ] ${task}`),
  ];

  if (issue.dependsOn?.length) {
    sections.push(
      '',
      '## Dependencies',
      ...issue.dependsOn.map((dependency) => `- ${dependency}`)
    );
  }

  sections.push(
    '',
    '## Acceptance criteria',
    ...issue.acceptance.map((item) => `- [ ] ${item}`),
    '',
    '## Definition of done',
    ...definitionOfDone.map((item) => `- [ ] ${item}`)
  );

  return sections.join('\n');
}

function runGh(argsToRun, { input } = {}) {
  return execFileSync('gh', argsToRun, {
    encoding: 'utf8',
    input: input === undefined ? undefined : JSON.stringify(input),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function ensureGhAvailable() {
  try {
    runGh(['--version']);
    runGh(['auth', 'status']);
  } catch {
    console.error('GitHub CLI authentication is required. Install gh and run gh auth login.');
    process.exit(1);
  }
}

function apiJson(endpoint, { method = 'GET', body } = {}) {
  const command = ['api', endpoint];
  if (method !== 'GET') command.push('-X', method);
  if (body !== undefined) command.push('--input', '-');

  const output = runGh(command, { input: body });
  return output.trim() ? JSON.parse(output) : null;
}

function apiPaginated(endpoint) {
  const output = runGh(['api', '--paginate', '--slurp', endpoint]);
  const pages = JSON.parse(output);
  return pages.flat();
}

function printPlan() {
  console.log('Fitness product-completion roadmap');
  console.log('==================================');
  console.log('');
  console.log(`Repository: ${REPOSITORY}`);
  console.log(`Mode: ${APPLY ? 'APPLY changes' : 'dry run only'}`);
  console.log(`Milestones: ${productCompletionRoadmap.length}`);
  console.log(`Issues: ${issueCount}`);
  console.log('');

  for (const milestone of productCompletionRoadmap) {
    console.log(milestone.title);
    for (const issue of milestone.issues) {
      console.log(`  - ${issue.title}`);
    }
    console.log('');
  }

  if (!APPLY) {
    console.log('No GitHub changes were made. Re-run with --apply after reviewing the plan.');
  }
}

function ensureLabels() {
  const existing = new Map(
    apiPaginated(`repos/${REPOSITORY}/labels?per_page=100`).map((label) => [label.name, label])
  );

  for (const [name, definition] of Object.entries(roadmapLabels)) {
    const current = existing.get(name);
    if (!current) {
      apiJson(`repos/${REPOSITORY}/labels`, {
        method: 'POST',
        body: { name, ...definition },
      });
      console.log(`Created label: ${name}`);
      continue;
    }

    if (
      current.color.toLowerCase() !== definition.color.toLowerCase() ||
      (current.description ?? '') !== definition.description
    ) {
      apiJson(`repos/${REPOSITORY}/labels/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body: { new_name: name, ...definition },
      });
      console.log(`Updated label: ${name}`);
    }
  }
}

function ensureMilestones() {
  const milestones = apiPaginated(
    `repos/${REPOSITORY}/milestones?state=all&per_page=100`
  );
  const byTitle = new Map(milestones.map((milestone) => [milestone.title, milestone]));
  const milestoneNumbers = new Map();

  for (const definition of productCompletionRoadmap) {
    const description = [
      definition.description,
      '',
      'Exit conditions:',
      ...definition.exit.map((item) => `- ${item}`),
    ].join('\n');
    const current = byTitle.get(definition.title);

    if (!current) {
      const created = apiJson(`repos/${REPOSITORY}/milestones`, {
        method: 'POST',
        body: { title: definition.title, description },
      });
      milestoneNumbers.set(definition.key, created.number);
      console.log(`Created milestone #${created.number}: ${definition.title}`);
      continue;
    }

    milestoneNumbers.set(definition.key, current.number);
    if (current.description !== description || current.state !== 'open') {
      apiJson(`repos/${REPOSITORY}/milestones/${current.number}`, {
        method: 'PATCH',
        body: { title: definition.title, description, state: 'open' },
      });
      console.log(`Updated milestone #${current.number}: ${definition.title}`);
    }
  }

  return milestoneNumbers;
}

function listRoadmapIssues() {
  return apiPaginated(`repos/${REPOSITORY}/issues?state=all&per_page=100`)
    .filter((issue) => !issue.pull_request);
}

function createOrUpdateIssues(milestoneNumbers) {
  const issues = listRoadmapIssues();
  const byMarker = new Map();
  const openByTitle = new Map();

  for (const issue of issues) {
    const marker = issue.body?.match(/<!-- fitness-product-roadmap:([^ ]+) -->/)?.[1];
    if (marker) byMarker.set(marker, issue);
    if (issue.state === 'open') openByTitle.set(issue.title, issue);
  }

  for (const milestone of productCompletionRoadmap) {
    const milestoneNumber = milestoneNumbers.get(milestone.key);

    for (const issueDefinition of milestone.issues) {
      const body = renderIssueBody(issueDefinition, milestone);
      const labels = [
        'roadmap',
        `priority:${issueDefinition.priority}`,
        `area:${issueDefinition.area}`,
      ];
      const current = byMarker.get(issueDefinition.id) ?? openByTitle.get(issueDefinition.title);
      const payload = {
        title: issueDefinition.title,
        body,
        milestone: milestoneNumber,
        labels,
      };

      if (!current) {
        const created = apiJson(`repos/${REPOSITORY}/issues`, {
          method: 'POST',
          body: payload,
        });
        console.log(`Created #${created.number}: ${issueDefinition.title}`);
        continue;
      }

      apiJson(`repos/${REPOSITORY}/issues/${current.number}`, {
        method: 'PATCH',
        body: payload,
      });
      console.log(`Updated #${current.number}: ${issueDefinition.title}`);
    }
  }
}

function main() {
  printPlan();

  if (!APPLY) return;

  ensureGhAvailable();
  ensureLabels();
  const milestoneNumbers = ensureMilestones();
  createOrUpdateIssues(milestoneNumbers);

  console.log('');
  console.log('Product-completion roadmap applied successfully.');
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main();
