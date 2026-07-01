import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, '..', 'src', 'features', 'workouts', 'seed-exercises.json');
const exercises = JSON.parse(readFileSync(seedPath, 'utf8'));

const requiredFields = [
  'id',
  'name',
  'muscleGroup',
  'equipment',
  'movementType',
  'difficulty',
  'instructions',
  'externalId',
  'bodyPart',
  'targetMuscle',
];
const ids = new Set();
const errors = [];

if (!Array.isArray(exercises)) {
  errors.push('seed-exercises.json must contain an array.');
} else {
  if (exercises.length < 1000) {
    errors.push(`Expected at least 1,000 imported exercises, found ${exercises.length}.`);
  }

  exercises.forEach((exercise, index) => {
    requiredFields.forEach((field) => {
      if (!exercise[field] || typeof exercise[field] !== 'string') {
        errors.push(`Exercise ${index + 1} is missing string field: ${field}`);
      }
    });

    if (!/^[0-9a-f-]{36}$/i.test(exercise.id)) {
      errors.push(`Exercise ${index + 1} has a non-UUID id: ${exercise.id}`);
    }

    if ('secondaryMuscles' in exercise && !Array.isArray(exercise.secondaryMuscles)) {
      errors.push(`Exercise ${index + 1} secondaryMuscles must be an array when present.`);
    }

    if ('instructionSteps' in exercise && !Array.isArray(exercise.instructionSteps)) {
      errors.push(`Exercise ${index + 1} instructionSteps must be an array when present.`);
    }

    if (ids.has(exercise.id)) {
      errors.push(`Duplicate exercise id: ${exercise.id}`);
    }

    ids.add(exercise.id);
  });
}

if (errors.length > 0) {
  console.error('Exercise seed check failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const counts = exercises.reduce(
  (summary, exercise) => {
    summary.muscles.add(exercise.muscleGroup);
    summary.equipment.add(exercise.equipment);
    summary.movements.add(exercise.movementType);
    summary.difficulties.add(exercise.difficulty);
    summary.targets.add(exercise.targetMuscle);
    return summary;
  },
  {
    muscles: new Set(),
    equipment: new Set(),
    movements: new Set(),
    difficulties: new Set(),
    targets: new Set(),
  }
);

console.log(`Loaded ${exercises.length} local exercises.`);
console.log(`Muscles: ${[...counts.muscles].sort().join(', ')}`);
console.log(`Equipment: ${[...counts.equipment].sort().join(', ')}`);
console.log(`Movements: ${[...counts.movements].sort().join(', ')}`);
console.log(`Difficulties: ${[...counts.difficulties].sort().join(', ')}`);
console.log(`Target muscles: ${[...counts.targets].sort().join(', ')}`);
