import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';

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
  const toneStyles =
    tone === 'blue'
      ? { badge: styles.badgePrimary, text: styles.badgePrimaryText }
      : { badge: styles.badgeNeutral, text: styles.badgeNeutralText };

  return (
    <View className={`rounded-pill border px-3 py-1 ${toneClasses.badge}`} style={[styles.badge, toneStyles.badge]}>
      <Text className={`text-xs font-black ${toneClasses.text}`} style={[styles.badgeText, toneStyles.text]}>
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
      className={`rounded-pill border px-3 py-2 active:opacity-75 ${
        selected
          ? 'border-primary bg-primary/15'
          : 'border-base-300 bg-base-100 active:bg-base-300'
      }`}
      style={({ pressed }) => [
        styles.filterChip,
        selected ? styles.filterChipSelected : styles.filterChipIdle,
        pressed && (selected ? styles.pressedSelected : styles.pressedIdle),
      ]}
    >
      <Text
        className={`text-sm font-black ${selected ? 'text-primary' : 'text-base-content'}`}
        style={[styles.filterChipText, selected ? styles.filterChipTextSelected : styles.filterChipTextIdle]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LibraryButton({
  title,
  onPress,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
}) {
  const isOutline = variant === 'outline';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.libraryButton,
        isOutline ? styles.libraryButtonOutline : styles.libraryButtonPrimary,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.libraryButtonText, isOutline ? styles.libraryButtonOutlineText : styles.libraryButtonPrimaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

function LibraryEmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.emptyStateCard}>
      <View style={styles.emptyStateAccent} />
      <View style={styles.emptyStateTextGroup}>
        <Text style={styles.emptyStateTitle}>{title}</Text>
        <Text style={styles.emptyStateMessage}>{message}</Text>
      </View>
      {action}
    </View>
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
    <View className="gap-3" style={styles.exerciseList}>
      {filteredExercises.length === 0 ? (
        <LibraryEmptyState
          title={hasActiveFilters ? 'No exercises match these filters' : 'Exercise library is empty'}
          message={
            hasActiveFilters
              ? 'Clear the search or filters to get back to the seeded exercise list.'
              : 'No seeded exercises were returned. Retry the local library, then run npm run check:exercises if this keeps happening.'
          }
          action={
            hasActiveFilters ? (
              <LibraryButton title="Clear search and filters" onPress={clearFilters} variant="outline" />
            ) : (
              <LibraryButton title="Retry exercise library" onPress={() => void refetch()} variant="outline" />
            )
          }
        />
      ) : (
        filteredExercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            onPress={() => setSelectedExercise(exercise)}
            className="gap-3 rounded-card border border-base-300 bg-base-100 p-4 active:border-primary/40 active:bg-base-300 active:opacity-90"
            style={({ pressed }) => [styles.exerciseCard, pressed && styles.exerciseCardPressed]}
          >
            <View className="flex-row items-start justify-between gap-3" style={styles.exerciseCardHeader}>
              <View className="flex-1" style={styles.exerciseCardTitleGroup}>
                <Text className="text-lg font-black text-base-content" style={styles.exerciseCardTitle}>
                  {exercise.name}
                </Text>
                <Text className="mt-1 text-sm font-body text-base-muted" style={styles.exerciseCardSubtitle}>
                  {exercise.muscleGroup}
                </Text>
              </View>
              {exercise.equipment ? <ExerciseBadge label={exercise.equipment} /> : null}
            </View>

            <View className="flex-row flex-wrap gap-2" style={styles.badgeRow}>
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
      <View className="gap-3" style={styles.headerSection}>
        <View className="flex-row items-start justify-between gap-3" style={styles.libraryHeader}>
          <View className="flex-1" style={styles.libraryHeaderText}>
            <Text className="text-2xl font-black text-base-content" style={styles.libraryTitle}>Exercise library</Text>
            <Text className="mt-1.5 font-body leading-5 text-base-muted" style={styles.librarySubtitle}>
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
          style={styles.searchInput}
        />
      </View>

      {isLoading ? (
        <View className="items-center gap-2.5 py-7" style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text className="font-bold text-base-muted" style={styles.loadingText}>
            Loading exercises…
          </Text>
        </View>
      ) : error ? (
        <LibraryEmptyState
          title="Could not load exercises"
          message={`The local exercise seed file could not be read. Run npm run check:exercises to verify the seed data.${error?.message ? ` Detail: ${error.message}` : ''}`}
          action={<LibraryButton title="Try again" onPress={() => void refetch()} />}
        />
      ) : (
        <>
          <View className="flex-row flex-wrap items-center justify-between gap-2.5" style={styles.toolbar}>
            <Text className="font-bold text-base-muted" style={styles.visibleCountText}>
              {filteredExercises.length} of {exercises.length} exercises visible
            </Text>
            <View className="flex-row items-center gap-3" style={styles.toolbarActions}>
              {hasActiveFilters ? (
                <Pressable onPress={clearFilters} className="rounded-pill px-2 py-2 active:opacity-75" style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
                  <Text className="font-black text-primary" style={styles.clearButtonText}>
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
                style={({ pressed }) => [
                  styles.filterButton,
                  activeFilterCount > 0 ? styles.filterChipSelected : styles.filterChipIdle,
                  pressed && (activeFilterCount > 0 ? styles.pressedSelected : styles.pressedIdle),
                ]}
              >
                <Text
                  className={activeFilterCount > 0 ? 'font-black text-primary' : 'font-black text-base-content'}
                  style={[styles.filterButtonText, activeFilterCount > 0 ? styles.filterChipTextSelected : styles.filterChipTextIdle]}
                >
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
        <Pressable onPress={() => setIsFilterSheetOpen(false)} style={styles.modalBackdrop}>
          <Pressable
            onPress={(event: GestureResponderEvent) => event.stopPropagation()}
            className="gap-4 rounded-t-card border border-base-300 bg-base-200 p-5 pb-7"
            style={[styles.modalSheet, styles.filterSheet]}
          >
            <View className="h-1 w-12 self-center rounded-pill bg-base-300" style={styles.sheetHandle} />

            <View className="flex-row items-start justify-between gap-3" style={styles.sheetHeader}>
              <View className="flex-1 gap-1.5" style={styles.sheetTitleGroup}>
                <Text className="text-2xl font-black text-base-content" style={styles.sheetTitle}>Filters</Text>
                <Text className="font-body leading-5 text-base-muted" style={styles.sheetSubtitle}>
                  Narrow the library by muscle, equipment, movement, or level.
                </Text>
              </View>
              {activeFilterCount > 0 ? (
                <Pressable onPress={clearStructuredFilters} className="rounded-pill px-2 py-1 active:opacity-75" style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
                  <Text className="font-black text-primary" style={styles.clearButtonText}>Clear all</Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerClassName="gap-4.5 pb-1"
              contentContainerStyle={styles.filterScrollContent}
            >
              {FILTERS.map((filter) => (
                <View key={filter.key} className="gap-2" style={styles.filterGroup}>
                  <Text className="font-black text-base-content" style={styles.filterGroupLabel}>
                    {filter.label}
                  </Text>
                  <View className="flex-row flex-wrap gap-2" style={styles.chipRow}>
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

            <View className="gap-2" style={styles.sheetFooter}>
              <Text className="text-center font-bold text-base-muted" style={styles.sheetFooterText}>
                {filteredExercises.length} exercises visible
              </Text>
              <LibraryButton title="Show exercises" onPress={() => setIsFilterSheetOpen(false)} />
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
        <Pressable onPress={() => setSelectedExercise(null)} style={styles.modalBackdrop}>
          <Pressable
            onPress={(event: GestureResponderEvent) => event.stopPropagation()}
            className="gap-4 rounded-t-card border border-base-300 bg-base-200 p-5 pb-8"
            style={styles.modalSheet}
          >
            {selectedExercise ? (
              <>
                <View className="h-1 w-12 self-center rounded-pill bg-base-300" style={styles.sheetHandle} />

                <View className="gap-2" style={styles.detailTitleGroup}>
                  <Text className="text-3xl font-black text-base-content" style={styles.detailTitle}>
                    {selectedExercise.name}
                  </Text>
                  <View className="flex-row flex-wrap gap-2" style={styles.badgeRow}>
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

                <View className="h-36 items-center justify-center rounded-card border border-dashed border-base-300 bg-base-100" style={styles.diagramPlaceholder}>
                  <Text className="font-black text-base-muted" style={styles.diagramPlaceholderTitle}>
                    Muscle diagram placeholder
                  </Text>
                  <Text className="mt-1.5 text-base-muted/80" style={styles.diagramPlaceholderSubtitle}>
                    {selectedExercise.muscleGroup}
                  </Text>
                </View>

                <View className="gap-1.5" style={styles.instructionsGroup}>
                  <Text className="text-base font-black text-base-content" style={styles.instructionsTitle}>Instructions</Text>
                  <Text className="font-body leading-6 text-base-muted" style={styles.instructionsText}>
                    {selectedExercise.instructions ||
                      'Instructions have not been added for this exercise yet.'}
                  </Text>
                </View>

                {onSelect ? (
                  <LibraryButton
                    title={selectButtonTitle}
                    onPress={() => selectExercise(selectedExercise)}
                  />
                ) : null}

                <Pressable
                  onPress={() => setSelectedExercise(null)}
                  className="items-center rounded-pill py-2 active:opacity-75"
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <Text className="font-black text-base-muted" style={styles.closeButtonText}>Close</Text>
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
        style={styles.containedScroll}
        contentContainerClassName="gap-4 pb-1"
        contentContainerStyle={styles.scrollContent}
      >
        {libraryContent}
      </ScrollView>
    );
  }

  return <View className="gap-4" style={styles.pageLibrary}>{libraryContent}</View>;
}

const styles = StyleSheet.create({
  pageLibrary: {
    gap: 16,
  },
  containedScroll: {
    backgroundColor: colors.base200,
    maxHeight: '100%',
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 4,
  },
  headerSection: {
    gap: 12,
  },
  libraryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  libraryHeaderText: {
    flex: 1,
  },
  libraryTitle: {
    color: colors.baseContent,
    fontSize: 24,
    fontWeight: '900',
  },
  librarySubtitle: {
    color: colors.baseMuted,
    lineHeight: 20,
    marginTop: 6,
  },
  searchInput: {
    backgroundColor: colors.base100,
    borderColor: colors.base300,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.baseContent,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  loadingState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  loadingText: {
    color: colors.baseMuted,
    fontWeight: '800',
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  toolbarActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  visibleCountText: {
    color: colors.baseMuted,
    fontWeight: '800',
  },
  clearButton: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: colors.primary,
    fontWeight: '900',
  },
  filterButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterButtonText: {
    fontWeight: '900',
  },
  exerciseList: {
    gap: 12,
  },
  exerciseCard: {
    backgroundColor: colors.base100,
    borderColor: colors.base300,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  exerciseCardPressed: {
    backgroundColor: colors.base300,
    borderColor: colors.primary,
    opacity: 0.9,
  },
  exerciseCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  exerciseCardTitleGroup: {
    flex: 1,
  },
  exerciseCardTitle: {
    color: colors.baseContent,
    fontSize: 18,
    fontWeight: '900',
  },
  exerciseCardSubtitle: {
    color: colors.baseMuted,
    fontSize: 14,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgePrimary: {
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
    borderColor: 'rgba(163, 230, 53, 0.4)',
  },
  badgeNeutral: {
    backgroundColor: colors.base300,
    borderColor: colors.base300,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  badgePrimaryText: {
    color: colors.primary,
  },
  badgeNeutralText: {
    color: colors.baseMuted,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipIdle: {
    backgroundColor: colors.base100,
    borderColor: colors.base300,
  },
  filterChipSelected: {
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.75,
  },
  pressedIdle: {
    backgroundColor: colors.base300,
  },
  pressedSelected: {
    opacity: 0.75,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '900',
  },
  filterChipTextIdle: {
    color: colors.baseContent,
  },
  filterChipTextSelected: {
    color: colors.primary,
  },
  emptyStateCard: {
    alignItems: 'center',
    backgroundColor: colors.base100,
    borderColor: colors.base300,
    borderRadius: 24,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  emptyStateAccent: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 8,
    width: 64,
  },
  emptyStateTextGroup: {
    gap: 4,
  },
  emptyStateTitle: {
    color: colors.baseContent,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyStateMessage: {
    color: colors.baseMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  libraryButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  libraryButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  libraryButtonOutline: {
    backgroundColor: 'transparent',
    borderColor: colors.primary,
  },
  libraryButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  libraryButtonPrimaryText: {
    color: colors.primaryContent,
  },
  libraryButtonOutlineText: {
    color: colors.primary,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.base200,
    borderColor: colors.base300,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    gap: 16,
    padding: 20,
    paddingBottom: 32,
  },
  filterSheet: {
    maxHeight: '85%',
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: colors.base300,
    borderRadius: 999,
    height: 4,
    width: 48,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sheetTitleGroup: {
    flex: 1,
    gap: 6,
  },
  sheetTitle: {
    color: colors.baseContent,
    fontSize: 24,
    fontWeight: '900',
  },
  sheetSubtitle: {
    color: colors.baseMuted,
    lineHeight: 20,
  },
  filterScrollContent: {
    gap: 18,
    paddingBottom: 4,
  },
  filterGroup: {
    gap: 8,
  },
  filterGroupLabel: {
    color: colors.baseContent,
    fontWeight: '900',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetFooter: {
    gap: 8,
  },
  sheetFooterText: {
    color: colors.baseMuted,
    fontWeight: '800',
    textAlign: 'center',
  },
  detailTitleGroup: {
    gap: 8,
  },
  detailTitle: {
    color: colors.baseContent,
    fontSize: 30,
    fontWeight: '900',
  },
  diagramPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.base100,
    borderColor: colors.base300,
    borderRadius: 24,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 144,
    justifyContent: 'center',
  },
  diagramPlaceholderTitle: {
    color: colors.baseMuted,
    fontWeight: '900',
  },
  diagramPlaceholderSubtitle: {
    color: colors.baseMuted,
    marginTop: 6,
    opacity: 0.8,
  },
  instructionsGroup: {
    gap: 6,
  },
  instructionsTitle: {
    color: colors.baseContent,
    fontSize: 16,
    fontWeight: '900',
  },
  instructionsText: {
    color: colors.baseMuted,
    lineHeight: 24,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: colors.baseMuted,
    fontWeight: '900',
  },
});
