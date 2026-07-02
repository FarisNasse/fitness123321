import { ScrollView, View } from 'react-native';

import { Screen } from '@/src/components/Screen';
import { colors } from '@/src/lib/theme';

import type { LiveWorkoutController } from '../liveWorkoutState';
import { ActiveSetLogger } from './ActiveSetLogger';
import { DockedLogSetAction } from './DockedLogSetAction';
import { ExerciseSwitcher } from './ExerciseSwitcher';
import { LiveWorkoutHeader } from './LiveWorkoutHeader';
import { NoExerciseState } from './NoExerciseState';
import { RecentSetList } from './RecentSetList';
import { SavedSetNotice } from './SavedSetNotice';
import { EditSetSheet } from './sheets/EditSetSheet';
import { ExerciseInstructionsSheet } from './sheets/ExerciseInstructionsSheet';
import { ExercisePickerSheet } from './sheets/ExercisePickerSheet';
import { FinishWorkoutSheet } from './sheets/FinishWorkoutSheet';
import { TargetSettingsSheet } from './sheets/TargetSettingsSheet';

export function LiveWorkoutScreenView({ controller }: { controller: LiveWorkoutController }) {
  const hasExercises = controller.selectedExercises.length > 0;

  return (
    <Screen scrollable={false}>
      <View style={{ flex: 1, backgroundColor: colors.base100 }}>
        <LiveWorkoutHeader controller={controller} />
        {hasExercises ? <ExerciseSwitcher controller={controller} /> : null}

        <ScrollView
          contentContainerStyle={{ gap: 14, padding: 18, paddingBottom: 112 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {controller.savedNotice ? <SavedSetNotice notice={controller.savedNotice} /> : null}

          {controller.selectedExercise ? (
            <>
              <ActiveSetLogger controller={controller} />
              <RecentSetList sets={controller.recentSets} onEdit={controller.openEditSheet} />
            </>
          ) : (
            <NoExerciseState onAddExercise={controller.openExercisePicker} />
          )}
        </ScrollView>

        <DockedLogSetAction controller={controller} />

        <ExercisePickerSheet controller={controller} />
        <TargetSettingsSheet controller={controller} />
        <ExerciseInstructionsSheet controller={controller} />
        <EditSetSheet controller={controller} />
        <FinishWorkoutSheet controller={controller} />
      </View>
    </Screen>
  );
}
