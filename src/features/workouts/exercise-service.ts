import { USE_SUPABASE_EXERCISES } from '@/src/lib/runtime-flags';
import type { Exercise } from '@/src/types/models';

declare function require(path: string): unknown;

const seededExercises = require('./seed-exercises.json') as Exercise[];
let exerciseCache = seededExercises;

type ExerciseRow = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string | null;
  movement_type: string | null;
  difficulty: string | null;
  instructions: string | null;
  video_url: string | null;
};

function mapExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment ?? undefined,
    movementType: row.movement_type ?? undefined,
    difficulty: row.difficulty ?? undefined,
    instructions: row.instructions ?? undefined,
    videoUrl: row.video_url ?? undefined,
  };
}

function sortExercises(exercises: Exercise[]) {
  return [...exercises].sort((a, b) => a.name.localeCompare(b.name));
}

export function getSeededExercises() {
  return sortExercises(seededExercises);
}

export function rememberExercises(exercises: Exercise[]) {
  const byId = new Map(exerciseCache.map((exercise) => [exercise.id, exercise]));

  for (const exercise of exercises) {
    byId.set(exercise.id, exercise);
  }

  exerciseCache = Array.from(byId.values());
}

export function getExerciseById(exerciseId: string) {
  return exerciseCache.find((exercise) => exercise.id === exerciseId) ?? null;
}

function getExerciseFetchMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }

  return 'Unknown Supabase error';
}

async function fetchSupabaseExercises() {
  const { supabase } = await import('@/src/lib/supabase');

  const { data, error } = await supabase
    .from('exercises')
    .select(
      'id, name, muscle_group, equipment, movement_type, difficulty, instructions, video_url'
    )
    .order('name', { ascending: true });

  if (error) {
    throw new Error(getExerciseFetchMessage(error));
  }

  return ((data ?? []) as ExerciseRow[]).map(mapExercise);
}

export async function fetchExercises() {
  if (!USE_SUPABASE_EXERCISES) {
    const exercises = getSeededExercises();
    rememberExercises(exercises);
    return exercises;
  }

  try {
    const remoteExercises = await fetchSupabaseExercises();
    const exercises = remoteExercises.length > 0 ? remoteExercises : getSeededExercises();
    rememberExercises(exercises);
    return exercises;
  } catch (error) {
    console.warn('Failed to fetch exercises from Supabase. Using local seed data.', error);
    const exercises = getSeededExercises();
    rememberExercises(exercises);
    return exercises;
  }
}
