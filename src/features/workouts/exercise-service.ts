import { supabase } from '@/src/lib/supabase';
import type { Exercise } from '@/src/types/models';

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

export async function fetchExercises() {
  const { data, error } = await supabase
    .from('exercises')
    .select(
      'id, name, muscle_group, equipment, movement_type, difficulty, instructions, video_url'
    )
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ExerciseRow[]).map(mapExercise);
}
