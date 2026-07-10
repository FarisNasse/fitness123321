import assert from 'node:assert/strict';
import test from 'node:test';

import { renderIssueBody } from '../scripts/github/apply-product-completion-roadmap.mjs';
import {
  definitionOfDone,
  productCompletionRoadmap,
  roadmapLabels,
} from '../scripts/github/product-completion-roadmap.mjs';

const issues = productCompletionRoadmap.flatMap((milestone) =>
  milestone.issues.map((issue) => ({ ...issue, milestone }))
);

test('product roadmap contains seven milestones and twenty-six implementation issues', () => {
  assert.equal(productCompletionRoadmap.length, 7);
  assert.equal(issues.length, 26);
  assert.deepEqual(
    productCompletionRoadmap.map((milestone) => milestone.key),
    ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']
  );
});

test('roadmap issue identifiers, titles, and markers are stable and unique', () => {
  const ids = new Set();
  const titles = new Set();

  for (const { milestone, ...issue } of issues) {
    assert.match(issue.id, /^P[0-2]\.\d+$/);
    assert.ok(!ids.has(issue.id), `duplicate issue id: ${issue.id}`);
    assert.ok(!titles.has(issue.title), `duplicate issue title: ${issue.title}`);
    ids.add(issue.id);
    titles.add(issue.title);

    const body = renderIssueBody(issue, milestone);
    assert.match(body, new RegExp(`<!-- fitness-product-roadmap:${issue.id.replace('.', '\\.')} -->`));
    assert.match(body, /## Goal/);
    assert.match(body, /## Implementation checklist/);
    assert.match(body, /## Acceptance criteria/);
    assert.match(body, /## Definition of done/);
  }
});

test('every issue has actionable scope, acceptance criteria, and valid dependency references', () => {
  const knownIds = new Set(issues.map(({ id }) => id));

  for (const issue of issues) {
    assert.ok(issue.goal.length >= 40, `${issue.id} needs a specific goal`);
    assert.ok(issue.tasks.length >= 3, `${issue.id} needs at least three tasks`);
    assert.ok(issue.acceptance.length >= 2, `${issue.id} needs at least two acceptance checks`);
    assert.ok(['P0', 'P1', 'P2'].includes(issue.priority));
    assert.ok(roadmapLabels[`priority:${issue.priority}`]);
    assert.ok(roadmapLabels[`area:${issue.area}`], `${issue.id} uses an unknown area label`);

    for (const dependency of issue.dependsOn ?? []) {
      assert.ok(knownIds.has(dependency), `${issue.id} references unknown dependency ${dependency}`);
      assert.notEqual(dependency, issue.id, `${issue.id} cannot depend on itself`);
    }
  }
});

test('milestones define exit conditions and the shared definition of done is complete', () => {
  for (const milestone of productCompletionRoadmap) {
    assert.ok(milestone.description.length >= 40);
    assert.ok(milestone.exit.length >= 3);
    assert.ok(milestone.issues.length >= 3);
  }

  assert.equal(definitionOfDone.length, 4);
  assert.ok(definitionOfDone.some((item) => item.includes('merged')));
  assert.ok(definitionOfDone.some((item) => item.includes('tests')));
  assert.ok(definitionOfDone.some((item) => item.includes('manually verified')));
  assert.ok(definitionOfDone.some((item) => item.includes('Documentation')));
});
