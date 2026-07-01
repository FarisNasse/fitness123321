import { Screen } from '@/src/components/Screen';
import { ExerciseLibrary } from '@/src/features/workouts/ExerciseLibrary';

export default function WorkoutExercisesScreen() {
  return (
    <Screen scrollable={false}>
      <ExerciseLibrary scrollMode="page" />
    </Screen>
  );
}
