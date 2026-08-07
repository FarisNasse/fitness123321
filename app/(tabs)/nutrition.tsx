import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { EmptyState } from '@/src/components/EmptyState';
import { Input } from '@/src/components/Input';
import { MetricCard } from '@/src/components/MetricCard';
import { ProgressBar } from '@/src/components/ProgressBar';
import { Screen } from '@/src/components/Screen';
import { useAuthSession } from '@/src/features/auth/auth-session-context';
import { SectionHeader } from '@/src/components/SectionHeader';
import {
  DEFAULT_DAILY_TARGETS,
  addLocalMealItem,
  addLocalWaterLog,
  createFood,
  getDailyNutritionSummary,
  searchFoodsByName,
  subscribeToNutritionLogChanges,
  syncPendingNutritionLogs,
  type DailyNutritionSummary,
} from '@/src/features/nutrition/nutrition-service';
import { reportError } from '@/src/lib/error-reporting';
import type { Food, MealType } from '@/src/types/models';

const mealTypes: { label: string; value: MealType }[] = [
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Snack', value: 'snack' },
];

const waterPresets = [250, 500, 750];

const emptySummary: DailyNutritionSummary = {
  entries: [],
  waterLogs: [],
  totals: {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    waterMl: 0,
  },
};

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatMacro(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function progress(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(1, current / target);
}

export default function NutritionScreen() {
  const { session } = useAuthSession();
  const ownerId = session?.user.id ?? null;
  const [summary, setSummary] = useState<DailyNutritionSummary>(emptySummary);
  const [isAddFoodOpen, setIsAddFoodOpen] = useState(false);
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [searchQuery, setSearchQuery] = useState('');
  const [foodResults, setFoodResults] = useState<Food[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('serving');
  const [newFoodName, setNewFoodName] = useState('');
  const [servingSize, setServingSize] = useState('1');
  const [servingUnit, setServingUnit] = useState('serving');
  const [calories, setCalories] = useState('0');
  const [protein, setProtein] = useState('0');
  const [carbs, setCarbs] = useState('0');
  const [fat, setFat] = useState('0');

  const refreshSummary = useCallback(() => {
    setSummary(ownerId ? getDailyNutritionSummary(ownerId) : emptySummary);
  }, [ownerId]);

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  useEffect(() => {
    if (!ownerId) return undefined;
    return subscribeToNutritionLogChanges(ownerId, refreshSummary);
  }, [ownerId, refreshSummary]);

  useEffect(() => {
    let cancelled = false;

    if (!searchQuery.trim()) {
      setFoodResults([]);
      setIsSearching(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);

      void searchFoodsByName(searchQuery)
        .then((foods) => {
          if (!cancelled) {
            setFoodResults(foods);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            reportError(error, {
              source: 'nutrition-screen',
              operation: 'search-foods',
              domain: 'nutrition',
            });
            Alert.alert('Unable to search foods', 'Food search is temporarily unavailable.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsSearching(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const entriesByMealType = useMemo(() => {
    const grouped: Record<MealType, typeof summary.entries> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };

    for (const entry of summary.entries) {
      grouped[entry.meal_type].push(entry);
    }

    return grouped;
  }, [summary]);

  const hasFoodEntries = summary.entries.length > 0;
  const calorieProgress = progress(summary.totals.calories, DEFAULT_DAILY_TARGETS.calories);
  const proteinProgress = progress(summary.totals.proteinG, DEFAULT_DAILY_TARGETS.proteinG);
  const waterProgress = progress(summary.totals.waterMl, DEFAULT_DAILY_TARGETS.waterMl);

  function resetAddFoodForm() {
    setMealType('breakfast');
    setSearchQuery('');
    setFoodResults([]);
    setSelectedFood(null);
    setQuantity('1');
    setUnit('serving');
    setNewFoodName('');
    setServingSize('1');
    setServingUnit('serving');
    setCalories('0');
    setProtein('0');
    setCarbs('0');
    setFat('0');
  }

  function chooseFood(food: Food) {
    setSelectedFood(food);
    setUnit(food.servingUnit ?? 'serving');
    setQuantity(String(food.servingSize ?? 1));
  }

  async function handleCreateFood() {
    const name = newFoodName.trim() || searchQuery.trim();
    const parsedServingSize = parsePositiveNumber(servingSize);
    const parsedCalories = parseNonNegativeNumber(calories);
    const parsedProtein = parseNonNegativeNumber(protein);
    const parsedCarbs = parseNonNegativeNumber(carbs);
    const parsedFat = parseNonNegativeNumber(fat);

    if (!name) {
      Alert.alert('Missing food name', 'Enter a food name before creating it.');
      return;
    }

    if (!parsedServingSize) {
      Alert.alert('Invalid serving size', 'Enter a serving size greater than 0.');
      return;
    }

    if (
      parsedCalories === null ||
      parsedProtein === null ||
      parsedCarbs === null ||
      parsedFat === null
    ) {
      Alert.alert('Invalid macros', 'Calories and macros must be 0 or greater.');
      return;
    }

    try {
      const food = await createFood({
        name,
        servingSize: parsedServingSize,
        servingUnit: servingUnit.trim() || 'serving',
        calories: parsedCalories,
        proteinG: parsedProtein,
        carbsG: parsedCarbs,
        fatG: parsedFat,
      });

      setFoodResults((current) => [food, ...current.filter((item) => item.id !== food.id)]);
      setSelectedFood(food);
      setSearchQuery(food.name);
      setQuantity(String(food.servingSize ?? 1));
      setUnit(food.servingUnit ?? 'serving');
    } catch (error) {
      reportError(error, {
        source: 'nutrition-screen',
        operation: 'create-food',
        domain: 'nutrition',
      });
      Alert.alert('Unable to create food', 'The food could not be created. Please try again.');
    }
  }

  async function handleLogFood() {
    const parsedQuantity = parsePositiveNumber(quantity);

    if (!selectedFood) {
      Alert.alert('Select a food', 'Search for a food or create a new one first.');
      return;
    }

    if (!parsedQuantity) {
      Alert.alert('Invalid quantity', 'Enter a quantity greater than 0.');
      return;
    }

    try {
      if (!ownerId) throw new Error('A signed-in nutrition owner is required.');

      addLocalMealItem({
        userId: ownerId,
        mealType,
        food: selectedFood,
        quantity: parsedQuantity,
        unit: unit.trim() || selectedFood.servingUnit || 'serving',
      });

      refreshSummary();
      resetAddFoodForm();
      setIsAddFoodOpen(false);

      void syncPendingNutritionLogs().catch((error) => {
        reportError(error, {
          source: 'nutrition-screen',
          operation: 'sync-after-food-log',
          domain: 'nutrition',
        });
      });
    } catch (error) {
      reportError(error, {
        source: 'nutrition-screen',
        operation: 'log-food',
        domain: 'nutrition',
      });
      Alert.alert('Unable to log food', 'The food entry could not be saved. Please try again.');
    }
  }

  async function handleQuickAddWater(amountMl: number) {
    try {
      if (!ownerId) throw new Error('A signed-in nutrition owner is required.');
      addLocalWaterLog({ userId: ownerId, amountMl });
      refreshSummary();

      void syncPendingNutritionLogs().catch((error) => {
        reportError(error, {
          source: 'nutrition-screen',
          operation: 'sync-after-water-log',
          domain: 'nutrition',
        });
      });
    } catch (error) {
      reportError(error, {
        source: 'nutrition-screen',
        operation: 'log-water',
        domain: 'nutrition',
      });
      Alert.alert('Unable to add water', 'The water entry could not be saved. Please try again.');
    }
  }

  return (
    <Screen>
      <View className="gap-5">
        <View className="gap-2">
          <Text className="text-base font-bold uppercase tracking-widest text-primary">
            Eat
          </Text>
          <Text className="text-4xl font-display text-base-content">Nutrition</Text>
          <Text className="text-sm font-body leading-6 text-base-muted">
            Track meals, macros, calories, and water intake.
          </Text>
        </View>

        <View className="flex-row gap-3">
          <MetricCard label="Calories" value={String(summary.totals.calories)} progress={calorieProgress} />
          <MetricCard label="Protein" value={`${formatMacro(summary.totals.proteinG)}g`} progress={proteinProgress} />
        </View>

        <View className="flex-row gap-3">
          <MetricCard label="Carbs" value={`${formatMacro(summary.totals.carbsG)}g`} />
          <MetricCard label="Fat" value={`${formatMacro(summary.totals.fatG)}g`} />
        </View>

        <Card variant="highlighted" className="gap-4">
          <SectionHeader eyebrow="Daily macros" title="Targets" />
          <MacroProgress label="Calories" value={String(summary.totals.calories)} progress={calorieProgress} />
          <MacroProgress label="Protein" value={`${formatMacro(summary.totals.proteinG)}g`} progress={proteinProgress} />
          <MacroProgress label="Water" value={`${summary.totals.waterMl} ml`} progress={waterProgress} />
        </Card>

        <Card className="gap-3">
          <SectionHeader title="Food logger" />
          <Text className="text-sm font-body leading-6 text-base-muted">
            Search or create a food, pick a meal, and log the quantity.
          </Text>
          <Button title="Add food" onPress={() => setIsAddFoodOpen(true)} />
        </Card>

        <Card className="gap-3">
          <SectionHeader title="Water" />
          <Text className="text-sm font-body text-base-muted">
            {summary.totals.waterMl} ml logged today
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {waterPresets.map((amountMl) => (
              <Pressable
                key={amountMl}
                onPress={() => void handleQuickAddWater(amountMl)}
                className="rounded-pill border border-info bg-info/20 px-4 py-3 active:opacity-75"
              >
                <Text className="text-sm font-bold text-info">+{amountMl} ml</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card className="gap-4">
          <SectionHeader title="Today's entries" />
          {!hasFoodEntries ? (
            <EmptyState title="No foods logged today" message="Add a meal or snack to start building today's log." />
          ) : (
            <View className="gap-5">
              {mealTypes.map((meal) => {
                const entries = entriesByMealType[meal.value];

                if (entries.length === 0) return null;

                const mealCalories = entries.reduce(
                  (sum, entry) => sum + Number(entry.calories ?? 0),
                  0
                );

                return (
                  <View key={meal.value} className="gap-3">
                    <Text className="text-base font-bold text-base-content">
                      {meal.label} / {Math.round(mealCalories)} kcal
                    </Text>
                    {entries.map((entry) => (
                      <View
                        key={entry.local_id}
                        className="gap-1 rounded-card border border-base-300 bg-base-100 p-3"
                      >
                        <Text className="text-base font-bold text-base-content">
                          {entry.food_name}
                        </Text>
                        <Text className="text-sm font-body text-base-muted">
                          {formatMacro(Number(entry.quantity))} {entry.unit ?? ''} /{' '}
                          {Math.round(Number(entry.calories))} kcal
                        </Text>
                        <Text className="text-sm font-body text-base-muted">
                          P {formatMacro(Number(entry.protein_g))}g / C{' '}
                          {formatMacro(Number(entry.carbs_g))}g / F{' '}
                          {formatMacro(Number(entry.fat_g))}g
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </View>

      <Modal
        animationType="slide"
        visible={isAddFoodOpen}
        onRequestClose={() => setIsAddFoodOpen(false)}
      >
        <View className="flex-1 bg-base-100">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-5 pt-5 pb-12"
          >
            <View className="gap-5">
              <View className="gap-2">
                <Text className="text-4xl font-display text-base-content">Add food</Text>
                <Text className="text-sm font-body leading-6 text-base-muted">
                  Choose a meal, select or create a food, then log the amount.
                </Text>
              </View>

              <Card className="gap-3">
                <Text className="text-xl font-bold text-base-content">Meal</Text>
                <View className="flex-row flex-wrap gap-2">
                  {mealTypes.map((meal) => {
                    const isSelected = mealType === meal.value;

                    return (
                      <Pressable
                        key={meal.value}
                        onPress={() => setMealType(meal.value)}
                        className={`rounded-pill border px-4 py-3 ${
                          isSelected
                            ? 'border-primary bg-primary'
                            : 'border-base-300 bg-base-100'
                        }`}
                      >
                        <Text
                          className={`text-sm font-bold ${
                            isSelected ? 'text-primary-content' : 'text-base-content'
                          }`}
                        >
                          {meal.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>

              <Card className="gap-3">
                <Text className="text-xl font-bold text-base-content">Food search</Text>
                <Input
                  value={searchQuery}
                  onChangeText={(value) => {
                    setSearchQuery(value);
                    setSelectedFood(null);
                    setNewFoodName(value);
                  }}
                  placeholder="Search food name..."
                  autoCapitalize="words"
                />
                <Text className="text-xs font-bold text-base-muted">
                  {isSearching ? 'Searching foods...' : 'Search public.foods by name.'}
                </Text>

                {foodResults.length > 0 ? (
                  <View className="gap-2">
                    {foodResults.map((food) => {
                      const isSelected = selectedFood?.id === food.id;

                      return (
                        <Pressable
                          key={food.id}
                          onPress={() => chooseFood(food)}
                          className={`gap-1 rounded-card border p-3 ${
                            isSelected
                              ? 'border-primary bg-primary/10'
                              : 'border-base-300 bg-base-100'
                          }`}
                        >
                          <Text className="text-base font-bold text-base-content">
                            {food.name}
                          </Text>
                          <Text className="text-sm font-body text-base-muted">
                            {Math.round(food.calories)} kcal / P {formatMacro(food.proteinG)}g / C{' '}
                            {formatMacro(food.carbsG)}g / F {formatMacro(food.fatG)}g
                          </Text>
                          <Text className="text-sm font-body text-base-muted">
                            Per {formatMacro(food.servingSize ?? 1)} {food.servingUnit ?? 'serving'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </Card>

              {searchQuery.trim() ? (
                <Card className="gap-3">
                  <Text className="text-xl font-bold text-base-content">Create new food</Text>
                  <Text className="text-sm font-body leading-6 text-base-muted">
                    Use this fallback if the food is not in search results.
                  </Text>
                  <Input
                    value={newFoodName}
                    onChangeText={setNewFoodName}
                    placeholder="Food name"
                  />
                  <View className="flex-row gap-3">
                    <Input
                      value={servingSize}
                      onChangeText={setServingSize}
                      keyboardType="numeric"
                      placeholder="Serving size"
                      containerClassName="flex-1"
                    />
                    <Input
                      value={servingUnit}
                      onChangeText={setServingUnit}
                      placeholder="Unit"
                      containerClassName="flex-1"
                    />
                  </View>
                  <View className="flex-row gap-3">
                    <Input
                      value={calories}
                      onChangeText={setCalories}
                      keyboardType="numeric"
                      placeholder="Calories"
                      containerClassName="flex-1"
                    />
                    <Input
                      value={protein}
                      onChangeText={setProtein}
                      keyboardType="numeric"
                      placeholder="Protein"
                      containerClassName="flex-1"
                    />
                  </View>
                  <View className="flex-row gap-3">
                    <Input
                      value={carbs}
                      onChangeText={setCarbs}
                      keyboardType="numeric"
                      placeholder="Carbs"
                      containerClassName="flex-1"
                    />
                    <Input
                      value={fat}
                      onChangeText={setFat}
                      keyboardType="numeric"
                      placeholder="Fat"
                      containerClassName="flex-1"
                    />
                  </View>
                  <Button title="Create new food" onPress={() => void handleCreateFood()} />
                </Card>
              ) : null}

              <Card className="gap-3">
                <Text className="text-xl font-bold text-base-content">Quantity</Text>
                {selectedFood ? (
                  <Text className="text-sm font-body text-base-muted">
                    Selected: {selectedFood.name}
                  </Text>
                ) : (
                  <Text className="text-sm font-body text-base-muted">
                    Select or create a food first.
                  </Text>
                )}
                <View className="flex-row gap-3">
                  <Input
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    placeholder="Quantity"
                    containerClassName="flex-1"
                  />
                  <Input
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="Unit"
                    containerClassName="flex-1"
                  />
                </View>
              </Card>

              <View className="gap-3">
                <Button title="Log food" onPress={() => void handleLogFood()} disabled={!selectedFood} />
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => {
                    resetAddFoodForm();
                    setIsAddFoodOpen(false);
                  }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

function MacroProgress({
  label,
  value,
  progress: progressValue,
}: {
  label: string;
  value: string;
  progress: number;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-widest text-base-muted">
          {label}
        </Text>
        <Text className="text-xs font-bold text-base-content">{value}</Text>
      </View>
      <ProgressBar value={progressValue} />
    </View>
  );
}
