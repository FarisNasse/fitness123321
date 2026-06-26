import { Screen } from '@/src/components/Screen';
import { ExerciseLibrary } from '@/src/features/workouts/ExerciseLibrary';

export default function WorkoutExercisesScreen() {
  return (
    <Screen>
      <ExerciseLibrary scrollMode="page" />
    </Screen>
  );
}
