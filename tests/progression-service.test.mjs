import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
function stripProgressionServiceTypescript(source) {
  const stripFunctionParameters = (_, functionName, parameters) => {
    const strippedParameters = parameters
      .split(',')
      .map((parameter) => parameter.replace(/:\s*[^=]+$/, '').trim())
      .join(', ');

    return `function${functionName}(${strippedParameters})`;
  };

  return source
    .replace(/^(?:export\s+)?type\s+\w+\s*=\s*\{[\s\S]*?^\};\r?\n/gm, '')
    .replace(/^export\s+type\s+\w+\s*=[^;]+;\r?\n/gm, '')
    .replace(/\((\w+)\)\s*:\s*[^=]+=>/g, '($1) =>')
    .replace(/function(\s+[A-Za-z_$][\w$]*\s*)\(([\s\S]*?)\)\s*(?::\s*[A-Za-z_$][\w$<>[\]\s|&,.]*)?/g, stripFunctionParameters);
}

async function loadProgressionService() {
  const tempDir = mkdtempSync(join(tmpdir(), 'progression-service-'));

  try {
    const serviceSource = readFileSync(
      resolve('src/features/workouts/progression-service.ts'),
      'utf8'
    );
    const fallbackModule = join(tempDir, 'progression-service.mjs');
    writeFileSync(fallbackModule, stripProgressionServiceTypescript(serviceSource));

    return await import(pathToFileURL(resolve(fallbackModule)).href);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function baseInput(overrides = {}) {
  return {
    exerciseId: 'bench-press',
    exerciseName: 'Bench press',
    currentSets: [],
    previousSets: [],
    targetSets: 3,
    repMin: 8,
    repMax: 12,
    incrementSize: 5,
    deloadPercentage: 10,
    ...overrides,
  };
}

test('progression service recommends increase after rep-range double progression is completed', async () => {
  const { buildProgressionRecommendation } = await loadProgressionService();
  const recommendation = buildProgressionRecommendation(
    baseInput({
      currentSets: [
        { reps: 12, weight: 100 },
        { reps: 12, weight: 100 },
        { reps: 12, weight: 100 },
      ],
      effortFeedback: 'good',
    })
  );

  assert.equal(recommendation.decision, 'increase');
  assert.equal(recommendation.nextReps, 8);
  assert.equal(recommendation.nextWeight, 105);
  assert.match(recommendation.reason, /hit 12 reps on all 3 target sets/i);
  assert.match(recommendation.oneRepMaxInsight, /progress clue|progress sign|rep-range rule/i);
});

test('progression service recommends repeat when reps are still inside the range', async () => {
  const { buildProgressionRecommendation } = await loadProgressionService();
  const recommendation = buildProgressionRecommendation(
    baseInput({
      currentSets: [
        { reps: 10, weight: 100 },
        { reps: 9, weight: 100 },
        { reps: 8, weight: 100 },
      ],
      previousSets: [
        { reps: 9, weight: 100 },
        { reps: 9, weight: 100 },
        { reps: 8, weight: 100 },
      ],
      effortFeedback: 'good',
    })
  );

  assert.equal(recommendation.decision, 'repeat');
  assert.equal(recommendation.nextWeight, 100);
  assert.match(recommendation.reason, /keep the same weight/i);
  assert.match(recommendation.reason, /8-12 rep range/i);
});

test('progression service recommends deload when reps miss the floor at max effort', async () => {
  const { buildProgressionRecommendation } = await loadProgressionService();
  const recommendation = buildProgressionRecommendation(
    baseInput({
      currentSets: [
        { reps: 7, weight: 100 },
        { reps: 6, weight: 100 },
        { reps: 5, weight: 100 },
      ],
      previousSets: [
        { reps: 10, weight: 100 },
        { reps: 10, weight: 100 },
        { reps: 10, weight: 100 },
      ],
      effortFeedback: 'max',
    })
  );

  assert.equal(recommendation.decision, 'deload');
  assert.equal(recommendation.nextReps, 8);
  assert.equal(recommendation.nextWeight, 90);
  assert.match(recommendation.reason, /below 8 at max effort/i);
});
