import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const defaultSourcePath = resolve(projectRoot, '..', 'exercises-dataset-main', 'data', 'exercises.json');
const defaultOutputPath = resolve(projectRoot, 'src', 'features', 'workouts', 'seed-exercises.json');

const sourcePath = resolve(process.argv[2] ?? defaultSourcePath);
const outputPath = resolve(process.argv[3] ?? defaultOutputPath);

const MUSCLE_GROUP_BY_BODY_PART = new Map([
  ['back', 'Back'],
  ['cardio', 'Cardio'],
  ['chest', 'Chest'],
  ['lower arms', 'Forearms'],
  ['lower legs', 'Calves'],
  ['neck', 'Neck'],
  ['shoulders', 'Shoulders'],
  ['upper arms', 'Arms'],
  ['upper legs', 'Legs'],
  ['waist', 'Core'],
]);

const MOVEMENT_BY_BODY_PART = new Map([
  ['back', 'Pull'],
  ['cardio', 'Cardio'],
  ['chest', 'Push'],
  ['lower arms', 'Accessory'],
  ['lower legs', 'Accessory'],
  ['neck', 'Accessory'],
  ['shoulders', 'Push'],
  ['upper arms', 'Accessory'],
  ['upper legs', 'Legs'],
  ['waist', 'Core'],
]);

const BODYWEIGHT_TERMS = new Set(['body weight', 'assisted']);
const CARDIO_TERMS = new Set([
  'elliptical machine',
  'skierg machine',
  'stationary bike',
  'stepmill machine',
  'upper body ergometer',
]);

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function titleCase(value) {
  const normalized = normalizeWhitespace(value);

  return normalized.replace(/\b[\p{L}\p{N}][\p{L}\p{N}'’/°-]*/gu, (word) => {
    if (/^[A-Z0-9/-]+$/.test(word)) return word;
    return word.charAt(0).toLocaleUpperCase('en-US') + word.slice(1);
  });
}

function stableUuidFromExerciseId(externalId) {
  const hash = createHash('sha1').update(`exercise-dataset:${externalId}`).digest('hex').slice(0, 32);
  const chars = hash.split('');
  chars[12] = '5';
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const id = chars.join('');

  return [
    id.slice(0, 8),
    id.slice(8, 12),
    id.slice(12, 16),
    id.slice(16, 20),
    id.slice(20),
  ].join('-');
}

function normalizeEquipment(equipment) {
  const value = normalizeWhitespace(equipment).toLowerCase();

  if (!value) return 'Unspecified';
  if (BODYWEIGHT_TERMS.has(value)) return 'Bodyweight';
  if (value === 'ez barbell') return 'EZ Barbell';
  if (value === 'bosu ball') return 'BOSU Ball';

  return titleCase(value);
}

function normalizeMuscleGroup(exercise) {
  const bodyPart = normalizeWhitespace(exercise.body_part ?? exercise.category).toLowerCase();
  const target = normalizeWhitespace(exercise.target).toLowerCase();

  return MUSCLE_GROUP_BY_BODY_PART.get(bodyPart) ?? titleCase(target || bodyPart || 'General');
}

function inferMovementType(exercise) {
  const equipment = normalizeWhitespace(exercise.equipment).toLowerCase();
  const bodyPart = normalizeWhitespace(exercise.body_part ?? exercise.category).toLowerCase();
  const name = normalizeWhitespace(exercise.name).toLowerCase();

  if (CARDIO_TERMS.has(equipment) || bodyPart === 'cardio') return 'Cardio';
  if (/squat|lunge|leg press|step-up|split squat|hack squat/.test(name)) return 'Squat';
  if (/deadlift|hinge|good morning|hip thrust|pull through|glute bridge/.test(name)) return 'Hinge';
  if (/row|pull-up|pulldown|pull down|chin-up|chin up/.test(name)) return 'Pull';
  if (/press|push-up|push up|dip|fly/.test(name)) return 'Push';
  if (/curl|extension|raise|shrug|calf|wrist|neck/.test(name)) return 'Accessory';
  if (/crunch|sit-up|sit up|plank|twist|rollout|leg raise|side bend/.test(name)) return 'Core';

  return MOVEMENT_BY_BODY_PART.get(bodyPart) ?? 'Accessory';
}

function inferDifficulty(exercise) {
  const equipment = normalizeWhitespace(exercise.equipment).toLowerCase();
  const name = normalizeWhitespace(exercise.name).toLowerCase();

  if (/single arm|single leg|one arm|pistol|muscle up|handstand|dragon flag/.test(name)) {
    return 'Advanced';
  }

  if (BODYWEIGHT_TERMS.has(equipment) || CARDIO_TERMS.has(equipment)) {
    return 'Beginner';
  }

  return 'Intermediate';
}

function getEnglishText(value) {
  return normalizeWhitespace(value?.en ?? value ?? '');
}

function getEnglishSteps(value) {
  const steps = value?.en;

  if (!Array.isArray(steps)) return [];

  return steps.map(normalizeWhitespace).filter(Boolean);
}

function mapExercise(exercise) {
  const instructionSteps = getEnglishSteps(exercise.instruction_steps);
  const instructions = getEnglishText(exercise.instructions) || instructionSteps.join(' ');
  const bodyPart = titleCase(exercise.body_part ?? exercise.category ?? 'General');
  const targetMuscle = titleCase(exercise.target ?? exercise.muscle_group ?? bodyPart);
  const secondaryMuscles = Array.isArray(exercise.secondary_muscles)
    ? exercise.secondary_muscles.map(titleCase).filter(Boolean)
    : [];

  return {
    id: stableUuidFromExerciseId(exercise.id),
    externalId: String(exercise.id),
    name: titleCase(exercise.name),
    muscleGroup: normalizeMuscleGroup(exercise),
    equipment: normalizeEquipment(exercise.equipment),
    movementType: inferMovementType(exercise),
    difficulty: inferDifficulty(exercise),
    instructions,
    bodyPart,
    targetMuscle,
    secondaryMuscles,
    instructionSteps,
    mediaId: normalizeWhitespace(exercise.media_id) || undefined,
  };
}

function validateExercise(exercise, index, seenIds, seenNames) {
  const requiredStringFields = [
    'id',
    'externalId',
    'name',
    'muscleGroup',
    'equipment',
    'movementType',
    'difficulty',
    'instructions',
    'bodyPart',
    'targetMuscle',
  ];

  for (const field of requiredStringFields) {
    if (!exercise[field] || typeof exercise[field] !== 'string') {
      throw new Error(`Exercise ${index + 1} is missing required string field: ${field}`);
    }
  }

  if (!/^[0-9a-f-]{36}$/i.test(exercise.id)) {
    throw new Error(`${exercise.name} should use a UUID-like id.`);
  }

  if (seenIds.has(exercise.id)) {
    throw new Error(`Duplicate generated exercise id: ${exercise.id}`);
  }

  if (seenNames.has(exercise.name)) {
    throw new Error(`Duplicate exercise name after import: ${exercise.name}`);
  }

  seenIds.add(exercise.id);
  seenNames.add(exercise.name);
}

function readDataset(path) {
  if (!existsSync(path)) {
    throw new Error(`Could not find exercise dataset at ${path}`);
  }

  const data = JSON.parse(readFileSync(path, 'utf8'));

  if (!Array.isArray(data)) {
    throw new Error('Exercise dataset must be a JSON array.');
  }

  return data;
}

const rawExercises = readDataset(sourcePath);
const seenSourceNames = new Set();
const skippedDuplicateNames = [];
const importedExercises = [];

for (const rawExercise of rawExercises) {
  const normalizedSourceName = normalizeWhitespace(rawExercise.name).toLowerCase();

  if (seenSourceNames.has(normalizedSourceName)) {
    skippedDuplicateNames.push(rawExercise.name);
    continue;
  }

  seenSourceNames.add(normalizedSourceName);
  importedExercises.push(mapExercise(rawExercise));
}

importedExercises.sort((a, b) => a.name.localeCompare(b.name));

const seenIds = new Set();
const seenNames = new Set();
importedExercises.forEach((exercise, index) => validateExercise(exercise, index, seenIds, seenNames));

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(importedExercises, null, 2)}\n`);

console.log(`Imported ${importedExercises.length} exercises into ${outputPath}`);

if (skippedDuplicateNames.length > 0) {
  console.log(`Skipped ${skippedDuplicateNames.length} duplicate exercise names: ${skippedDuplicateNames.join(', ')}`);
}
