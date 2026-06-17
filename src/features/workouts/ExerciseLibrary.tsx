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
import { fetchExercises } from '@/src/features/workouts/exercise-service';
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
  const isBlue = tone === 'blue';
  return (
    <View
      style={{
        backgroundColor: isBlue ? '#e0f2fe' : '#f1f5f9',
        borderColor: isBlue ? '#bae6fd' : '#e2e8f0',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text
        style={{
          color: isBlue ? '#0369a1' : '#475569',
          fontSize: 12,
          fontWeight: '900',
        }}
      >
        {label}
      </Text>
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
      style={({ pressed }) => ({
        backgroundColor: selected ? '#0f172a' : '#ffffff',
        borderColor: selected ? '#0f172a' : '#cbd5e1',
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? '#ffffff' : '#334155',
          fontSize: 13,
          fontWeight: '900',
        }}
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

  function selectExercise(exercise: Exercise) {
    onSelect?.(exercise);
    setSelectedExercise(null);
  }

  const hasActiveFilters =
    Boolean(searchQuery.trim()) || FILTERS.some((filter) => filters[filter.key]);

  const renderedExercises = (
    <View style={{ gap: 10 }}>
      {filteredExercises.length === 0 ? (
        <View
          style={{
            backgroundColor: '#f8fafc',
            borderColor: '#e2e8f0',
            borderRadius: 16,
            borderWidth: 1,
            padding: 16,
          }}
        >
          <Text style={{ fontWeight: '900' }}>No exercises found</Text>
          <Text style={{ color: '#64748b', marginTop: 6 }}>
            Try clearing the search or one of the filters.
          </Text>
        </View>
      ) : (
        filteredExercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            onPress={() => setSelectedExercise(exercise)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#f1f5f9' : '#ffffff',
              borderColor: '#e2e8f0',
              borderRadius: 18,
              borderWidth: 1,
              padding: 14,
              gap: 10,
            })}
          >
            <View
              style={{
                alignItems: 'flex-start',
                flexDirection: 'row',
                gap: 10,
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '900' }}>
                  {exercise.name}
                </Text>
                <Text style={{ color: '#64748b', marginTop: 4 }}>
                  {exercise.muscleGroup}
                </Text>
              </View>
              {exercise.equipment ? <ExerciseBadge label={exercise.equipment} /> : null}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
      <View style={{ gap: 12 }}>
        <View
          style={{
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: 12,
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '900' }}>Exercise library</Text>
            <Text style={{ marginTop: 6, color: '#64748b', lineHeight: 21 }}>
              Browse seeded exercises, filter instantly, and open details before
              adding one to a workout.
            </Text>
          </View>
          <ExerciseBadge label={`${exercises.length} moves`} tone="slate" />
        </View>

        <TextInput
          autoCapitalize="none"
          placeholder="Search exercise, muscle, equipment..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{
            backgroundColor: '#f8fafc',
            borderColor: '#cbd5e1',
            borderRadius: 16,
            borderWidth: 1,
            fontSize: 16,
            padding: 14,
          }}
        />
      </View>

      {isLoading ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <ActivityIndicator />
          <Text style={{ color: '#64748b', fontWeight: '800' }}>
            Loading exercises…
          </Text>
        </View>
      ) : error ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: '#b91c1c', fontWeight: '900' }}>
            Could not load exercises.
          </Text>
          <Text style={{ color: '#64748b', lineHeight: 20 }}>
            The local exercise seed file could not be read. Run npm run
            check:exercises to verify the seed data.
          </Text>
          {error?.message ? (
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>{error.message}</Text>
          ) : null}
          <Button title="Try again" onPress={() => void refetch()} />
        </View>
      ) : (
        <>
          <View style={{ gap: 12 }}>
            {FILTERS.map((filter) => (
              <View key={filter.key} style={{ gap: 8 }}>
                <Text style={{ color: '#475569', fontWeight: '900' }}>
                  {filter.label}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 4 }}
                >
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
                </ScrollView>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#64748b', fontWeight: '800' }}>
              {filteredExercises.length} of {exercises.length} exercises
            </Text>
            {hasActiveFilters ? (
              <Pressable onPress={clearFilters}>
                <Text style={{ color: '#0f172a', fontWeight: '900' }}>
                  Clear
                </Text>
              </Pressable>
            ) : null}
          </View>

          {renderedExercises}
        </>
      )}

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
            style={{
              backgroundColor: '#ffffff',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              gap: 16,
              padding: 20,
              paddingBottom: 32,
            }}
          >
            {selectedExercise ? (
              <>
                <View
                  style={{
                    alignSelf: 'center',
                    backgroundColor: '#cbd5e1',
                    borderRadius: 999,
                    height: 4,
                    width: 46,
                  }}
                />

                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 26, fontWeight: '900' }}>
                    {selectedExercise.name}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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

                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                    borderColor: '#cbd5e1',
                    borderRadius: 22,
                    borderStyle: 'dashed',
                    borderWidth: 1,
                    height: 150,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#64748b', fontWeight: '900' }}>
                    Muscle diagram placeholder
                  </Text>
                  <Text style={{ color: '#94a3b8', marginTop: 6 }}>
                    {selectedExercise.muscleGroup}
                  </Text>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900' }}>Instructions</Text>
                  <Text style={{ color: '#475569', lineHeight: 22 }}>
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
                  style={{ alignItems: 'center', paddingVertical: 8 }}
                >
                  <Text style={{ color: '#64748b', fontWeight: '900' }}>Close</Text>
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
        style={{ maxHeight: '100%' }}
        contentContainerStyle={{ gap: 16, paddingBottom: 4 }}
      >
        {libraryContent}
      </ScrollView>
    );
  }

  return <View style={{ gap: 16 }}>{libraryContent}</View>;
}
