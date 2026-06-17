import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, '..', 'src', 'features', 'workouts', 'seed-exercises.json');
const exercises = JSON.parse(readFileSync(seedPath, 'utf8'));

const requiredFields = ['id', 'name', 'muscleGroup', 'equipment', 'movementType', 'difficulty', 'instructions'];
const ids = new Set();
const errors = [];

if (!Array.isArray(exercises)) {
  errors.push('seed-exercises.json must contain an array.');
} else {
  exercises.forEach((exercise, index) => {
    requiredFields.forEach((field) => {
      if (!exercise[field] || typeof exercise[field] !== 'string') {
        errors.push(`Exercise ${index + 1} is missing string field: ${field}`);
      }
    });

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
    return summary;
  },
  {
    muscles: new Set(),
    equipment: new Set(),
    movements: new Set(),
    difficulties: new Set(),
  }
);

console.log(`Loaded ${exercises.length} local exercises.`);
console.log(`Muscles: ${[...counts.muscles].sort().join(', ')}`);
console.log(`Equipment: ${[...counts.equipment].sort().join(', ')}`);
console.log(`Movements: ${[...counts.movements].sort().join(', ')}`);
console.log(`Difficulties: ${[...counts.difficulties].sort().join(', ')}`);
