import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
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
};

const FILTERS: { key: FilterKey; label: string; allLabel: string }[] = [
  { key: 'muscleGroup', label: 'Muscle', allLabel: 'All muscles' },
  { key: 'equipment', label: 'Equipment', allLabel: 'All equipment' },
  { key: 'movementType', label: 'Movement', allLabel: 'All movements' },
  { key: 'difficulty', label: 'Difficulty', allLabel: 'All levels' },
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

function ExerciseBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: '#e0f2fe',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text style={{ color: '#0369a1', fontSize: 12, fontWeight: '800' }}>
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
          fontWeight: '800',
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
}: ExerciseLibraryProps) {
  const [filters, setFilters] = useState(emptyFilters);
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
    return exercises.filter((exercise) => {
      return FILTERS.every((filter) => {
        const selected = filters[filter.key];
        return !selected || exercise[filter.key] === selected;
      });
    });
  }, [exercises, filters]);

  function setFilter(key: FilterKey, value: string | null) {
    setFilters((current) => ({
      ...current,
      [key]: current[key] === value ? null : value,
    }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
  }

  function selectExercise(exercise: Exercise) {
    onSelect?.(exercise);
    setSelectedExercise(null);
  }

  const hasActiveFilters = FILTERS.some((filter) => filters[filter.key]);

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ fontSize: 18, fontWeight: '800' }}>Exercise library</Text>
        <Text style={{ marginTop: 8, color: '#64748b' }}>
          Browse the seeded exercises and filter by muscle, equipment, movement,
          or difficulty.
        </Text>
      </View>

      {isLoading ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <ActivityIndicator />
          <Text style={{ color: '#64748b', fontWeight: '700' }}>
            Loading exercises…
          </Text>
        </View>
      ) : error ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: '#b91c1c', fontWeight: '800' }}>
            Could not load exercises.
          </Text>
          <Text style={{ color: '#64748b' }}>
            Run the latest Supabase migrations so public.exercises has the
            exercise-library columns and read policy.
          </Text>
          {error?.message ? (
            <Text style={{ color: '#94a3b8', fontSize: 12 }}>
              {error.message}
            </Text>
          ) : null}
          <Button title="Try again" onPress={() => void refetch()} />
        </View>
      ) : (
        <>
          <View style={{ gap: 12 }}>
            {FILTERS.map((filter) => (
              <View key={filter.key} style={{ gap: 8 }}>
                <Text style={{ color: '#475569', fontWeight: '800' }}>
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
            <Text style={{ color: '#64748b', fontWeight: '700' }}>
              {filteredExercises.length} of {exercises.length} exercises
            </Text>
            {hasActiveFilters ? (
              <Pressable onPress={clearFilters}>
                <Text style={{ color: '#0f172a', fontWeight: '800' }}>
                  Clear filters
                </Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: 380 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
          >
            {filteredExercises.length === 0 ? (
              <View
                style={{
                  borderColor: '#e2e8f0',
                  borderRadius: 14,
                  borderWidth: 1,
                  padding: 16,
                }}
              >
                <Text style={{ fontWeight: '800' }}>No exercises found</Text>
                <Text style={{ color: '#64748b', marginTop: 6 }}>
                  Try clearing one of the filters.
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
                    borderRadius: 14,
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
                      <Text style={{ fontSize: 16, fontWeight: '800' }}>
                        {exercise.name}
                      </Text>
                      <Text style={{ color: '#64748b', marginTop: 4 }}>
                        {exercise.muscleGroup}
                      </Text>
                    </View>
                    {exercise.equipment ? (
                      <ExerciseBadge label={exercise.equipment} />
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {exercise.movementType ? (
                      <Text style={{ color: '#64748b', fontWeight: '700' }}>
                        {exercise.movementType}
                      </Text>
                    ) : null}
                    {exercise.difficulty ? (
                      <Text style={{ color: '#64748b', fontWeight: '700' }}>
                        • {exercise.difficulty}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
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
                  <Text style={{ fontSize: 24, fontWeight: '900' }}>
                    {selectedExercise.name}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <ExerciseBadge label={selectedExercise.muscleGroup} />
                    {selectedExercise.equipment ? (
                      <ExerciseBadge label={selectedExercise.equipment} />
                    ) : null}
                    {selectedExercise.movementType ? (
                      <ExerciseBadge label={selectedExercise.movementType} />
                    ) : null}
                    {selectedExercise.difficulty ? (
                      <ExerciseBadge label={selectedExercise.difficulty} />
                    ) : null}
                  </View>
                </View>

                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: '#f1f5f9',
                    borderColor: '#e2e8f0',
                    borderRadius: 18,
                    borderStyle: 'dashed',
                    borderWidth: 1,
                    height: 160,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#64748b', fontWeight: '800' }}>
                    Muscle diagram placeholder
                  </Text>
                  <Text style={{ color: '#94a3b8', marginTop: 6 }}>
                    {selectedExercise.muscleGroup}
                  </Text>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800' }}>
                    Instructions
                  </Text>
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
                  <Text style={{ color: '#64748b', fontWeight: '800' }}>
                    Close
                  </Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
