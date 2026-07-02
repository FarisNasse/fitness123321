import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const [dockedActionHeight, setDockedActionHeight] = useState(0);
  const bottomScrollInset = dockedActionHeight + insets.bottom + 24;

  return (
    <Screen scrollable={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={{ flex: 1, backgroundColor: colors.base100 }}
      >
        <LiveWorkoutHeader controller={controller} />
        {hasExercises ? <ExerciseSwitcher controller={controller} /> : null}

        <ScrollView
          contentContainerStyle={{ gap: 14, padding: 18, paddingBottom: bottomScrollInset }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {controller.savedNotice ? (
            <SavedSetNotice
              actionLabel={controller.pendingDeletedSet ? 'Undo' : undefined}
              notice={controller.savedNotice}
              onAction={controller.pendingDeletedSet ? controller.undoDeletedSet : undefined}
            />
          ) : null}

          {controller.selectedExercise ? (
            <>
              <ActiveSetLogger controller={controller} />
              <RecentSetList sets={controller.recentSets} onEdit={controller.openEditSheet} />
            </>
          ) : (
            <NoExerciseState onAddExercise={controller.openExercisePicker} />
          )}
        </ScrollView>

        <DockedLogSetAction
          bottomInset={insets.bottom}
          controller={controller}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            setDockedActionHeight((current) =>
              Math.abs(current - nextHeight) > 1 ? nextHeight : current
            );
          }}
        />

        <ExercisePickerSheet controller={controller} />
        <TargetSettingsSheet controller={controller} />
        <ExerciseInstructionsSheet controller={controller} />
        <EditSetSheet controller={controller} />
        <FinishWorkoutSheet controller={controller} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
