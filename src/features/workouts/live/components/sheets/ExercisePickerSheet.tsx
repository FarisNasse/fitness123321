import { ExerciseLibrary } from '@/src/features/workouts/ExerciseLibrary';

import type { LiveWorkoutController } from '../../liveWorkoutState';
import { BaseSheet } from './BaseSheet';

export function ExercisePickerSheet({ controller }: { controller: LiveWorkoutController }) {
  return (
    <BaseSheet accessibilityLabel="Choose exercise" visible={controller.activeSheet === 'exercise-picker'} onClose={controller.closeSheet}>
      <ExerciseLibrary onSelect={controller.chooseExercise} selectButtonTitle="Use this exercise" />
    </BaseSheet>
  );
}
