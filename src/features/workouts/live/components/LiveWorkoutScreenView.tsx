import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { ExerciseLibrary } from '@/src/features/workouts/ExerciseLibrary';
import { colors } from '@/src/lib/theme';

import { formatClock, formatShortClock, rgba } from '../liveWorkoutFormatting';
import { formatLastSetSummary, formatRecentSetLine } from '../liveWorkoutSelectors';
import type { LiveWorkoutController, LocalWorkoutSetRow } from '../liveWorkoutState';

export function LiveWorkoutScreenView({ controller }: { controller: LiveWorkoutController }) {
  return (
    <Screen scrollable={false}>
      <View style={{ flex: 1, backgroundColor: colors.base100 }}>
        <LiveWorkoutHeader controller={controller} />
        <ExerciseSwitcher controller={controller} />

        <ScrollView
          contentContainerStyle={{ gap: 14, padding: 18, paddingBottom: 172 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {controller.savedNotice ? <SavedSetNotice notice={controller.savedNotice} /> : null}

          {controller.selectedExercise ? (
            <>
              <ActiveSetLogger controller={controller} />
              <RecentSetList
                sets={controller.recentSets}
                onEdit={controller.openEditSheet}
              />
            </>
          ) : (
            <NoExerciseState onAddExercise={controller.openExercisePicker} />
          )}
        </ScrollView>

        <DockedWorkoutActions controller={controller} />

        <ExercisePickerSheet controller={controller} />
        <TargetSettingsSheet controller={controller} />
        <ExerciseInstructionsSheet controller={controller} />
        <EditSetSheet controller={controller} />
        <FinishWorkoutSheet controller={controller} />
      </View>
    </Screen>
  );
}

function LiveWorkoutHeader({ controller }: { controller: LiveWorkoutController }) {
  return (
    <View
      style={{
        borderBottomColor: colors.base300,
        borderBottomWidth: 1,
        gap: 10,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 12,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 96 }}>
          <Text style={{ color: colors.baseContent, fontSize: 24, fontWeight: '900' }}>
            {controller.session.name ?? 'Quick workout'}
          </Text>
          <Text style={{ color: colors.baseMuted, fontWeight: '800', marginTop: 2 }}>
            {formatClock(controller.elapsedSeconds)} · {controller.sets.length} set{controller.sets.length === 1 ? '' : 's'} logged
          </Text>
        </View>
        <Pressable
          onPress={controller.openFinishSheet}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.base300 : colors.base200,
            borderColor: colors.base300,
            borderRadius: 14,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 10,
          })}
        >
          <Text style={{ color: colors.baseContent, fontWeight: '900' }}>Finish</Text>
        </Pressable>
      </View>

      <RestTimerStrip
        restSeconds={controller.restSeconds}
        onSkip={controller.skipRest}
      />
    </View>
  );
}

function RestTimerStrip({
  restSeconds,
  onSkip,
}: {
  restSeconds: number | null;
  onSkip: () => void;
}) {
  if (restSeconds === null) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.base200,
          borderColor: colors.base300,
          borderRadius: 14,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingVertical: 9,
        }}
      >
        <Text style={{ color: colors.baseMuted, fontWeight: '900' }}>Ready to log</Text>
        <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>Rest starts after a set</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: rgba(163, 230, 53, 0.12),
        borderColor: rgba(163, 230, 53, 0.26),
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 9,
      }}
    >
      <Text style={{ color: colors.baseContent, fontSize: 16, fontWeight: '900' }}>
        Rest {formatShortClock(restSeconds)}
      </Text>
      <Pressable
        onPress={onSkip}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.base300 : colors.base100,
          borderColor: colors.base300,
          borderRadius: 12,
          borderWidth: 1,
          paddingHorizontal: 12,
          paddingVertical: 7,
        })}
      >
        <Text style={{ color: colors.primary, fontWeight: '900' }}>Skip</Text>
      </Pressable>
    </View>
  );
}

function ExerciseSwitcher({ controller }: { controller: LiveWorkoutController }) {
  return (
    <View
      style={{
        borderBottomColor: colors.base300,
        borderBottomWidth: 1,
        paddingVertical: 12,
      }}
    >
      <ScrollView
        horizontal
        contentContainerStyle={{ gap: 10, paddingHorizontal: 18 }}
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {controller.selectedExercises.map((exercise) => {
          const active = exercise.id === controller.selectedExercise?.id;

          return (
            <Pressable
              key={exercise.id}
              onPress={() => void controller.selectExerciseForLogging(exercise)}
              style={({ pressed }) => ({
                alignItems: 'center',
                backgroundColor: active ? colors.primary : pressed ? colors.base300 : colors.base200,
                borderColor: active ? colors.primary : colors.base300,
                borderRadius: 999,
                borderWidth: 1,
                minHeight: 48,
                justifyContent: 'center',
                paddingHorizontal: 16,
              })}
            >
              <Text
                style={{
                  color: active ? colors.primaryContent : colors.baseContent,
                  fontWeight: '900',
                }}
              >
                {controller.exerciseProgressLabel(exercise)}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={controller.openExercisePicker}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.base300 : colors.base200,
            borderColor: colors.base300,
            borderRadius: 999,
            borderWidth: 1,
            minHeight: 48,
            justifyContent: 'center',
            paddingHorizontal: 18,
          })}
        >
          <Text style={{ color: colors.primary, fontWeight: '900' }}>+ Exercise</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SavedSetNotice({ notice }: { notice: string }) {
  return (
    <View
      style={{
        backgroundColor: rgba(34, 197, 94, 0.12),
        borderColor: rgba(34, 197, 94, 0.25),
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
      }}
    >
      <Text style={{ color: colors.baseContent, fontWeight: '900' }}>{notice}</Text>
      <Text style={{ color: colors.baseMuted, fontWeight: '800', marginTop: 2 }}>
        Next set is ready. Rest timer started.
      </Text>
    </View>
  );
}

function ActiveSetLogger({ controller }: { controller: LiveWorkoutController }) {
  const draft = controller.currentSetDraft;

  return (
    <View
      style={{
        backgroundColor: colors.base200,
        borderColor: colors.primary,
        borderRadius: 28,
        borderWidth: 1,
        gap: 18,
        padding: 18,
      }}
    >
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.baseContent, fontSize: 30, fontWeight: '900' }}>
          {draft.exerciseName}
        </Text>
        <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>
          {draft.targetSummary} · {draft.sourceLabel}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.base100,
          borderColor: colors.base300,
          borderRadius: 18,
          borderWidth: 1,
          gap: 4,
          padding: 14,
        }}
      >
        <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>
          LAST SET
        </Text>
        <Text style={{ color: colors.baseContent, fontSize: 20, fontWeight: '900' }}>
          {formatLastSetSummary(controller.lastSet)}
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.baseContent, fontSize: 28, fontWeight: '900' }}>
          Set {draft.setNumber}
        </Text>
        <SetValueStepper
          label="Reps"
          value={draft.reps}
          keyboardType="number-pad"
          decrementLabel="−"
          incrementLabel="+"
          onChangeText={(value) => controller.updateSelectedDraft({ reps: value })}
          onDecrement={() => controller.adjustReps(-1)}
          onIncrement={() => controller.adjustReps(1)}
        />
        <SetValueStepper
          label="Weight"
          value={draft.weight}
          keyboardType="decimal-pad"
          decrementLabel={`−${draft.incrementSize}`}
          incrementLabel={`+${draft.incrementSize}`}
          onChangeText={(value) => controller.updateSelectedDraft({ weight: value })}
          onDecrement={() => controller.adjustWeight(-draft.incrementSize)}
          onIncrement={() => controller.adjustWeight(draft.incrementSize)}
        />
        {draft.validationMessage ? (
          <Text style={{ color: colors.error, fontWeight: '800' }}>
            {draft.validationMessage}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <SecondaryAction label="Targets" onPress={controller.openTargetSheet} />
        {controller.selectedExercise?.instructions ? (
          <SecondaryAction label="Instructions" onPress={controller.openInstructionsSheet} />
        ) : null}
      </View>
    </View>
  );
}

function SetValueStepper({
  label,
  value,
  keyboardType,
  decrementLabel,
  incrementLabel,
  onChangeText,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: string;
  keyboardType: 'number-pad' | 'decimal-pad';
  decrementLabel: string;
  incrementLabel: string;
  onChangeText: (value: string) => void;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900' }}>
        {label}
      </Text>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
        <StepperButton label={decrementLabel} onPress={onDecrement} />
        <TextInput
          keyboardType={keyboardType}
          value={value}
          onChangeText={onChangeText}
          placeholder="0"
          placeholderTextColor={colors.baseMuted}
          style={valueInputStyle}
        />
        <StepperButton label={incrementLabel} onPress={onIncrement} />
      </View>
    </View>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.base300 : colors.base100,
        borderColor: colors.base300,
        borderRadius: 16,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 56,
        minWidth: 58,
      })}
    >
      <Text style={{ color: colors.baseContent, fontSize: 18, fontWeight: '900' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function RecentSetList({
  sets,
  onEdit,
}: {
  sets: LocalWorkoutSetRow[];
  onEdit: (set: LocalWorkoutSetRow) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.baseContent, fontSize: 20, fontWeight: '900' }}>
          Recent sets
        </Text>
        <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>Tap to edit</Text>
      </View>

      {sets.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.base200,
            borderColor: colors.base300,
            borderRadius: 16,
            borderWidth: 1,
            padding: 14,
          }}
        >
          <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>
            No sets yet.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {sets.map((set) => (
            <Pressable
              key={set.local_id}
              onPress={() => onEdit(set)}
              style={({ pressed }) => ({
                alignItems: 'center',
                backgroundColor: pressed ? colors.base300 : colors.base200,
                borderColor: colors.base300,
                borderRadius: 14,
                borderWidth: 1,
                flexDirection: 'row',
                justifyContent: 'space-between',
                minHeight: 52,
                paddingHorizontal: 14,
              })}
            >
              <Text style={{ color: colors.baseContent, fontSize: 17, fontWeight: '900' }}>
                {formatRecentSetLine(set)}
              </Text>
              <Text style={{ color: colors.primary, fontWeight: '900' }}>Edit</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function NoExerciseState({ onAddExercise }: { onAddExercise: () => void }) {
  return (
    <Card>
      <View style={{ gap: 14 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.baseContent, fontSize: 26, fontWeight: '900' }}>
            Start logging
          </Text>
          <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>
            Add your first exercise.
          </Text>
        </View>
        <Button title="+ Add exercise" onPress={onAddExercise} size="lg" />
      </View>
    </Card>
  );
}

function DockedWorkoutActions({ controller }: { controller: LiveWorkoutController }) {
  return (
    <View
      style={{
        backgroundColor: colors.base100,
        borderTopColor: colors.base300,
        borderTopWidth: 1,
        bottom: 0,
        gap: 10,
        left: 0,
        padding: 16,
        position: 'absolute',
        right: 0,
      }}
    >
      {controller.selectedExercise ? (
        <Pressable
          disabled={Boolean(controller.currentSetDraft.validationMessage)}
          onPress={controller.addSet}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: controller.currentSetDraft.validationMessage
              ? colors.baseMuted
              : colors.primary,
            borderRadius: 20,
            justifyContent: 'center',
            minHeight: 64,
            opacity: pressed ? 0.82 : 1,
          })}
        >
          <Text style={{ color: colors.primaryContent, fontSize: 20, fontWeight: '900' }}>
            {controller.currentSetDraft.logButtonTitle}
          </Text>
          <Text style={{ color: colors.primaryContent, fontWeight: '800', marginTop: 2 }}>
            {controller.currentSetDraft.logButtonDetail}
          </Text>
        </Pressable>
      ) : (
        <Button title="+ Add first exercise" onPress={controller.openExercisePicker} size="lg" />
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          title="+ Exercise"
          onPress={controller.openExercisePicker}
          variant="outline"
          className="flex-1"
        />
        <Button
          title="Finish workout"
          onPress={controller.openFinishSheet}
          variant="ghost"
          className="flex-1"
        />
      </View>
    </View>
  );
}

function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.base300 : colors.base100,
        borderColor: colors.base300,
        borderRadius: 999,
        borderWidth: 1,
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: 14,
      })}
    >
      <Text style={{ color: colors.baseContent, fontWeight: '900' }}>{label}</Text>
    </Pressable>
  );
}

function ExercisePickerSheet({ controller }: { controller: LiveWorkoutController }) {
  return (
    <BaseSheet
      visible={controller.activeSheet === 'exercise-picker'}
      onClose={controller.closeSheet}
    >
      <ExerciseLibrary
        onSelect={controller.chooseExercise}
        selectButtonTitle="Use this exercise"
      />
    </BaseSheet>
  );
}

function TargetSettingsSheet({ controller }: { controller: LiveWorkoutController }) {
  return (
    <BaseSheet visible={controller.activeSheet === 'targets'} onClose={controller.closeSheet}>
      <View style={{ gap: 18 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.baseContent, fontSize: 22, fontWeight: '900' }}>
            {controller.selectedExercise?.name ?? 'Exercise'} targets
          </Text>
          <Text style={{ color: colors.baseMuted, lineHeight: 20 }}>
            Secondary settings stay out of the logging path. Change them only when needed.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <TargetInput
            label="Sets"
            value={controller.targetInputs.targetSets}
            onChangeText={(value) => controller.updateTargetInput('targetSets', value)}
          />
          <TargetInput
            label="Rep min"
            value={controller.targetInputs.repMin}
            onChangeText={(value) => controller.updateTargetInput('repMin', value)}
          />
          <TargetInput
            label="Rep max"
            value={controller.targetInputs.repMax}
            onChangeText={(value) => controller.updateTargetInput('repMax', value)}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <TargetInput
            label="Increment"
            value={controller.targetInputs.incrementSize}
            onChangeText={(value) => controller.updateTargetInput('incrementSize', value)}
          />
          <TargetInput
            label="Deload %"
            value={controller.targetInputs.deloadPercentage}
            onChangeText={(value) => controller.updateTargetInput('deloadPercentage', value)}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button title="Cancel" onPress={controller.closeSheet} variant="outline" className="flex-1" />
          <Button title="Save targets" onPress={controller.saveSelectedExerciseTarget} className="flex-1" />
        </View>
      </View>
    </BaseSheet>
  );
}

function TargetInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={{ flex: 1, minWidth: 96 }}>
      <Text style={{ color: colors.baseMuted, fontSize: 12, fontWeight: '900', marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.baseMuted}
        style={sheetInputStyle}
      />
    </View>
  );
}

function ExerciseInstructionsSheet({ controller }: { controller: LiveWorkoutController }) {
  return (
    <BaseSheet visible={controller.activeSheet === 'instructions'} onClose={controller.closeSheet}>
      <View style={{ gap: 14 }}>
        <Text style={{ color: colors.baseContent, fontSize: 22, fontWeight: '900' }}>
          {controller.selectedExercise?.name ?? 'Exercise'} instructions
        </Text>
        <Text style={{ color: colors.baseMuted, fontSize: 16, lineHeight: 24 }}>
          {controller.selectedExercise?.instructions ?? 'No instructions saved for this exercise.'}
        </Text>
        <Button title="Close" onPress={controller.closeSheet} />
      </View>
    </BaseSheet>
  );
}

function EditSetSheet({ controller }: { controller: LiveWorkoutController }) {
  return (
    <BaseSheet visible={controller.activeSheet === 'edit-set'} onClose={controller.closeSheet}>
      <View style={{ gap: 20 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.baseContent, fontSize: 22, fontWeight: '900' }}>
            Edit set {controller.editingSet?.set_number}
          </Text>
          <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>
            Delete is inside this sheet so it is not a tiny inline row target.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 96 }}>
            <Text style={{ color: colors.baseContent, fontWeight: '800', marginBottom: 6 }}>Reps</Text>
            <TextInput
              keyboardType="number-pad"
              value={controller.editInputs.reps}
              onChangeText={(value) => controller.updateEditInput('reps', value)}
              placeholderTextColor={colors.baseMuted}
              style={sheetInputStyle}
            />
          </View>
          <View style={{ flex: 1, minWidth: 96 }}>
            <Text style={{ color: colors.baseContent, fontWeight: '800', marginBottom: 6 }}>Weight</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={controller.editInputs.weight}
              onChangeText={(value) => controller.updateEditInput('weight', value)}
              placeholderTextColor={colors.baseMuted}
              style={sheetInputStyle}
            />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button title="Cancel" onPress={controller.closeSheet} variant="outline" className="flex-1" />
            <Button title="Save" onPress={controller.saveEditedSet} className="flex-1" />
          </View>
          <Button title="Delete set" onPress={controller.deleteEditingSet} variant="danger" />
        </View>
      </View>
    </BaseSheet>
  );
}

function FinishWorkoutSheet({ controller }: { controller: LiveWorkoutController }) {
  return (
    <BaseSheet visible={controller.activeSheet === 'finish'} onClose={controller.closeSheet}>
      <View style={{ gap: 18 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.baseContent, fontSize: 24, fontWeight: '900' }}>
            Finish workout
          </Text>
          <Text style={{ color: colors.baseMuted, lineHeight: 21 }}>
            Feedback belongs here, after the logging loop, instead of competing with the next set.
          </Text>
        </View>

        {controller.hasDirtyActiveDraft ? (
          <View
            style={{
              backgroundColor: rgba(251, 191, 36, 0.12),
              borderColor: rgba(251, 191, 36, 0.3),
              borderRadius: 16,
              borderWidth: 1,
              padding: 12,
            }}
          >
            <Text style={{ color: colors.baseContent, fontWeight: '900' }}>
              Unsaved current set
            </Text>
            <Text style={{ color: colors.baseMuted, fontWeight: '800', marginTop: 2 }}>
              Log the set first, or complete without saving the draft.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.baseContent, fontWeight: '900' }}>
            How did this workout feel?
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['easy', 'good', 'max'] as const).map((feedback) => {
              const selected = controller.effortFeedback === feedback;
              const label = feedback === 'easy' ? 'Easy' : feedback === 'good' ? 'Good' : 'Max';

              return (
                <Pressable
                  key={feedback}
                  onPress={() => controller.setEffortFeedback(selected ? null : feedback)}
                  style={{
                    alignItems: 'center',
                    backgroundColor: selected ? colors.primary : colors.base100,
                    borderColor: selected ? colors.primary : colors.base300,
                    borderRadius: 14,
                    borderWidth: 1,
                    flex: 1,
                    minHeight: 48,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.primaryContent : colors.baseContent,
                      fontWeight: '900',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          {controller.hasDirtyActiveDraft ? (
            <Button title="Log current set first" onPress={controller.addSet} variant="outline" />
          ) : null}
          <Button title="Complete workout" onPress={controller.completeWorkout} />
          <Button title="Keep working out" onPress={controller.closeSheet} variant="ghost" />
        </View>
      </View>
    </BaseSheet>
  );
}

function BaseSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable
        onPress={onClose}
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          flex: 1,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: colors.base200,
            borderColor: colors.base300,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            maxHeight: '88%',
            overflow: 'hidden',
            padding: 20,
            paddingBottom: 34,
          }}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetInputStyle = {
  backgroundColor: colors.base100,
  borderWidth: 1,
  borderColor: colors.base300,
  color: colors.baseContent,
  borderRadius: 14,
  fontSize: 18,
  fontWeight: '800' as const,
  padding: 14,
};

const valueInputStyle = {
  ...sheetInputStyle,
  flex: 1,
  fontSize: 24,
  minHeight: 56,
  textAlign: 'center' as const,
};
