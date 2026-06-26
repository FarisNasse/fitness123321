import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { Button } from '@/src/components/Button';
import { EmptyState } from '@/src/components/EmptyState';
import { fetchExercises } from '@/src/features/workouts/exercise-service';
import { colors } from '@/src/lib/theme';
import type { Exercise } from '@/src/types/models';

type FilterKey = 'muscleGroup' | 'equipment' | 'movementType' | 'difficulty';

type ExerciseLibraryProps = {
  onSelect?: (exercise: Exercise) => void;
  selectButtonTitle?: string;
  scrollMode?: 'page' | 'contained';
};

const FILTERS: { key: FilterKey; label: string; allLabel: string }[] = [
  { key: 'muscleGroup', label: 'Muscle', allLabel: 'All' },
  { key: 'equipment', label: 'Equipment', allLabel: 'All' },
  { key: 'movementType', label: 'Movement', allLabel: 'All' },
  { key: 'difficulty', label: 'Level', allLabel: 'All' },
];

const emptyFilters: Record<FilterKey, string | null> = {
  muscleGroup: null,
  equipment: null,
  movementType: null,
  difficulty: null,
};

function uniqueValues(exercises: Exercise[], key: FilterKey) {
  return Array.from(
    new Set(
      exercises
        .map((exercise) => exercise[key])
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));
}

function ExerciseBadge({ label, tone = 'blue' }: { label: string; tone?: 'blue' | 'slate' }) {
  const toneClasses =
    tone === 'blue'
      ? { badge: 'border-primary/40 bg-primary/15', text: 'text-primary' }
      : { badge: 'border-base-300 bg-base-300', text: 'text-base-muted' };

  return (
    <View className={`rounded-pill border px-3 py-1 ${toneClasses.badge}`}>
      <Text className={`text-xs font-black ${toneClasses.text}`}>{label}</Text>
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-pill border px-3 py-2 active:opacity-75 ${
        selected
          ? 'border-primary bg-primary/15'
          : 'border-base-300 bg-base-100 active:bg-base-300'
      }`}
    >
      <Text
        className={`text-sm font-black ${selected ? 'text-primary' : 'text-base-content'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ExerciseLibrary({
  onSelect,
  selectButtonTitle = 'Select exercise',
  scrollMode = 'contained',
}: ExerciseLibraryProps) {
  const [filters, setFilters] = useState(emptyFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const {
    data: exercises = [],
    error,
    isLoading,
    refetch,
  } = useQuery<Exercise[], Error>({
    queryKey: ['exercises'],
    queryFn: fetchExercises,
  });

  const filterOptions = useMemo(() => {
    return FILTERS.reduce(
      (options, filter) => ({
        ...options,
        [filter.key]: uniqueValues(exercises, filter.key),
      }),
      {} as Record<FilterKey, string[]>
    );
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return exercises.filter((exercise) => {
      const matchesFilters = FILTERS.every((filter) => {
        const selected = filters[filter.key];
        return !selected || exercise[filter.key] === selected;
      });

      if (!matchesFilters) return false;

      if (!normalizedSearch) return true;

      return [
        exercise.name,
        exercise.muscleGroup,
        exercise.equipment,
        exercise.movementType,
        exercise.difficulty,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [exercises, filters, searchQuery]);

  function setFilter(key: FilterKey, value: string | null) {
    setFilters((current) => ({
      ...current,
      [key]: current[key] === value ? null : value,
    }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setSearchQuery('');
  }

  function clearStructuredFilters() {
    setFilters(emptyFilters);
  }

  function selectExercise(exercise: Exercise) {
    onSelect?.(exercise);
    setSelectedExercise(null);
  }

  const activeFilterCount = FILTERS.filter((filter) => filters[filter.key]).length;
  const hasActiveSearch = Boolean(searchQuery.trim());
  const hasActiveFilters = hasActiveSearch || activeFilterCount > 0;

  const renderedExercises = (
    <View className="gap-3">
      {filteredExercises.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? 'No exercises match these filters' : 'Exercise library is empty'}
          message={
            hasActiveFilters
              ? 'Clear the search or filters to get back to the seeded exercise list.'
              : 'No seeded exercises were returned. Retry the local library, then run npm run check:exercises if this keeps happening.'
          }
          action={
            hasActiveFilters ? (
              <Button title="Clear search and filters" onPress={clearFilters} variant="outline" />
            ) : (
              <Button title="Retry exercise library" onPress={() => void refetch()} variant="outline" />
            )
          }
        />
      ) : (
        filteredExercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            onPress={() => setSelectedExercise(exercise)}
            className="gap-3 rounded-card border border-base-300 bg-base-100 p-4 active:border-primary/40 active:bg-base-300 active:opacity-90"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-lg font-black text-base-content">
                  {exercise.name}
                </Text>
                <Text className="mt-1 text-sm font-body text-base-muted">
                  {exercise.muscleGroup}
                </Text>
              </View>
              {exercise.equipment ? <ExerciseBadge label={exercise.equipment} /> : null}
            </View>

            <View className="flex-row flex-wrap gap-2">
              {exercise.movementType ? (
                <ExerciseBadge label={exercise.movementType} tone="slate" />
              ) : null}
              {exercise.difficulty ? (
                <ExerciseBadge label={exercise.difficulty} tone="slate" />
              ) : null}
            </View>
          </Pressable>
        ))
      )}
    </View>
  );

  const libraryContent = (
    <>
      <View className="gap-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-black text-base-content">Exercise library</Text>
            <Text className="mt-1.5 font-body leading-5 text-base-muted">
              Browse seeded exercises, filter instantly, and open details before
              adding one to a workout.
            </Text>
          </View>
          <ExerciseBadge label={`${exercises.length} moves`} tone="slate" />
        </View>

        <TextInput
          autoCapitalize="none"
          placeholder="Search exercise, muscle, or equipment"
          placeholderTextColor={colors.baseMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="rounded-input border border-base-300 bg-base-100 px-4 py-3 text-base font-body text-base-content"
        />
      </View>

      {isLoading ? (
        <View className="items-center gap-2.5 py-7">
          <ActivityIndicator />
          <Text className="font-bold text-base-muted">
            Loading exercises…
          </Text>
        </View>
      ) : error ? (
        <EmptyState
          title="Could not load exercises"
          message={`The local exercise seed file could not be read. Run npm run check:exercises to verify the seed data.${error?.message ? ` Detail: ${error.message}` : ''}`}
          action={<Button title="Try again" onPress={() => void refetch()} />}
        />
      ) : (
        <>
          <View className="flex-row flex-wrap items-center justify-between gap-2.5">
            <Text className="font-bold text-base-muted">
              {filteredExercises.length} of {exercises.length} exercises visible
            </Text>
            <View className="flex-row items-center gap-3">
              {hasActiveFilters ? (
                <Pressable onPress={clearFilters} className="rounded-pill px-2 py-2 active:opacity-75">
                  <Text className="font-black text-primary">
                    Clear
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setIsFilterSheetOpen(true)}
                className={`rounded-pill border px-4 py-2.5 active:opacity-75 ${
                  activeFilterCount > 0
                    ? 'border-primary bg-primary/15'
                    : 'border-base-300 bg-base-100 active:bg-base-300'
                }`}
              >
                <Text className={activeFilterCount > 0 ? 'font-black text-primary' : 'font-black text-base-content'}>
                  {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}
                </Text>
              </Pressable>
            </View>
          </View>

          {renderedExercises}
        </>
      )}


      <Modal
        animationType="slide"
        onRequestClose={() => setIsFilterSheetOpen(false)}
        transparent
        visible={isFilterSheetOpen}
      >
        <Pressable
          onPress={() => setIsFilterSheetOpen(false)}
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            flex: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(event: GestureResponderEvent) => event.stopPropagation()}
            className="gap-4 rounded-t-card border border-base-300 bg-base-200 p-5 pb-7"
            style={{ maxHeight: '85%' }}
          >
            <View className="h-1 w-12 self-center rounded-pill bg-base-300" />

            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1.5">
                <Text className="text-2xl font-black text-base-content">Filters</Text>
                <Text className="font-body leading-5 text-base-muted">
                  Narrow the library by muscle, equipment, movement, or level.
                </Text>
              </View>
              {activeFilterCount > 0 ? (
                <Pressable onPress={clearStructuredFilters} className="rounded-pill px-2 py-1 active:opacity-75">
                  <Text className="font-black text-primary">Clear all</Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerClassName="gap-4.5 pb-1"
            >
              {FILTERS.map((filter) => (
                <View key={filter.key} className="gap-2">
                  <Text className="font-black text-base-content">
                    {filter.label}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    <FilterChip
                      label={filter.allLabel}
                      selected={!filters[filter.key]}
                      onPress={() => setFilter(filter.key, null)}
                    />
                    {filterOptions[filter.key].map((option) => (
                      <FilterChip
                        key={option}
                        label={option}
                        selected={filters[filter.key] === option}
                        onPress={() => setFilter(filter.key, option)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View className="gap-2">
              <Text className="text-center font-bold text-base-muted">
                {filteredExercises.length} exercises visible
              </Text>
              <Button title="Show exercises" onPress={() => setIsFilterSheetOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedExercise(null)}
        transparent
        visible={Boolean(selectedExercise)}
      >
        <Pressable
          onPress={() => setSelectedExercise(null)}
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            flex: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(event: GestureResponderEvent) => event.stopPropagation()}
            className="gap-4 rounded-t-card border border-base-300 bg-base-200 p-5 pb-8"
          >
            {selectedExercise ? (
              <>
                <View className="h-1 w-12 self-center rounded-pill bg-base-300" />

                <View className="gap-2">
                  <Text className="text-3xl font-black text-base-content">
                    {selectedExercise.name}
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    <ExerciseBadge label={selectedExercise.muscleGroup} />
                    {selectedExercise.equipment ? (
                      <ExerciseBadge label={selectedExercise.equipment} />
                    ) : null}
                    {selectedExercise.movementType ? (
                      <ExerciseBadge label={selectedExercise.movementType} tone="slate" />
                    ) : null}
                    {selectedExercise.difficulty ? (
                      <ExerciseBadge label={selectedExercise.difficulty} tone="slate" />
                    ) : null}
                  </View>
                </View>

                <View className="h-36 items-center justify-center rounded-card border border-dashed border-base-300 bg-base-100">
                  <Text className="font-black text-base-muted">
                    Muscle diagram placeholder
                  </Text>
                  <Text className="mt-1.5 text-base-muted/80">
                    {selectedExercise.muscleGroup}
                  </Text>
                </View>

                <View className="gap-1.5">
                  <Text className="text-base font-black text-base-content">Instructions</Text>
                  <Text className="font-body leading-6 text-base-muted">
                    {selectedExercise.instructions ||
                      'Instructions have not been added for this exercise yet.'}
                  </Text>
                </View>

                {onSelect ? (
                  <Button
                    title={selectButtonTitle}
                    onPress={() => selectExercise(selectedExercise)}
                  />
                ) : null}

                <Pressable
                  onPress={() => setSelectedExercise(null)}
                  className="items-center rounded-pill py-2 active:opacity-75"
                >
                  <Text className="font-black text-base-muted">Close</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );

  if (scrollMode === 'contained') {
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        className="max-h-full"
        contentContainerClassName="gap-4 pb-1"
      >
        {libraryContent}
      </ScrollView>
    );
  }

  return <View className="gap-4">{libraryContent}</View>;
}
