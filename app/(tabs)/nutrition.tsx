import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { MetricCard } from '@/src/components/MetricCard';
import { Screen } from '@/src/components/Screen';
import {
  addLocalMealItem,
  addLocalWaterLog,
  createFood,
  getDailyNutritionSummary,
  getNutritionOwnerUserId,
  searchFoodsByName,
  syncPendingNutritionLogs,
  type DailyNutritionSummary,
} from '@/src/features/nutrition/nutrition-service';
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

function inputStyle() {
  return {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  };
}

export default function NutritionScreen() {
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
    setSummary(getDailyNutritionSummary());
  }, []);

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

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
            Alert.alert(
              'Unable to search foods',
              error instanceof Error ? error.message : 'Try again.'
            );
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
  }, [summary.entries]);

  const hasFoodEntries = summary.entries.length > 0;

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
      Alert.alert(
        'Unable to create food',
        error instanceof Error ? error.message : 'Try again.'
      );
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
      const userId = await getNutritionOwnerUserId();

      addLocalMealItem({
        userId,
        mealType,
        food: selectedFood,
        quantity: parsedQuantity,
        unit: unit.trim() || selectedFood.servingUnit || 'serving',
      });

      refreshSummary();
      resetAddFoodForm();
      setIsAddFoodOpen(false);

      void syncPendingNutritionLogs().catch((error) => {
        console.warn('Failed to sync pending nutrition logs.', error);
      });
    } catch (error) {
      Alert.alert(
        'Unable to log food',
        error instanceof Error ? error.message : 'Try again.'
      );
    }
  }

  async function handleQuickAddWater(amountMl: number) {
    try {
      const userId = await getNutritionOwnerUserId();
      addLocalWaterLog({ userId, amountMl });
      refreshSummary();

      void syncPendingNutritionLogs().catch((error) => {
        console.warn('Failed to sync pending nutrition logs.', error);
      });
    } catch (error) {
      Alert.alert(
        'Unable to add water',
        error instanceof Error ? error.message : 'Try again.'
      );
    }
  }

  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Nutrition</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Track meals, macros, calories, and water intake.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MetricCard label="Calories" value={String(summary.totals.calories)} />
          <MetricCard label="Protein" value={`${formatMacro(summary.totals.proteinG)}g`} />
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <MetricCard label="Carbs" value={`${formatMacro(summary.totals.carbsG)}g`} />
          <MetricCard label="Fat" value={`${formatMacro(summary.totals.fatG)}g`} />
        </View>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Food logger</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Search or create a food, pick a meal, and log the quantity.
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button title="Add food" onPress={() => setIsAddFoodOpen(true)} />
          </View>
        </Card>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Water</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            {summary.totals.waterMl} ml logged today
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {waterPresets.map((amountMl) => (
              <Pressable
                key={amountMl}
                onPress={() => void handleQuickAddWater(amountMl)}
                style={({ pressed }) => ({
                  backgroundColor: '#e0f2fe',
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text style={{ color: '#075985', fontWeight: '800' }}>+{amountMl} ml</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Today&apos;s entries</Text>
          {!hasFoodEntries ? (
            <Text style={{ marginTop: 8, color: '#64748b' }}>
              No foods logged today.
            </Text>
          ) : (
            <View style={{ gap: 16, marginTop: 12 }}>
              {mealTypes.map((meal) => {
                const entries = entriesByMealType[meal.value];

                if (entries.length === 0) return null;

                const mealCalories = entries.reduce(
                  (sum, entry) => sum + Number(entry.calories ?? 0),
                  0
                );

                return (
                  <View key={meal.value} style={{ gap: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800' }}>
                      {meal.label} · {Math.round(mealCalories)} kcal
                    </Text>
                    {entries.map((entry) => (
                      <View
                        key={entry.local_id}
                        style={{
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          borderRadius: 12,
                          padding: 12,
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontWeight: '800' }}>{entry.food_name}</Text>
                        <Text style={{ color: '#64748b' }}>
                          {formatMacro(Number(entry.quantity))} {entry.unit ?? ''} ·{' '}
                          {Math.round(Number(entry.calories))} kcal
                        </Text>
                        <Text style={{ color: '#64748b' }}>
                          P {formatMacro(Number(entry.protein_g))}g · C{' '}
                          {formatMacro(Number(entry.carbs_g))}g · F{' '}
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
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <View style={{ gap: 16 }}>
              <View>
                <Text style={{ fontSize: 28, fontWeight: '900' }}>Add food</Text>
                <Text style={{ marginTop: 8, color: '#64748b' }}>
                  Choose a meal, select or create a food, then log the amount.
                </Text>
              </View>

              <Card>
                <Text style={{ fontSize: 18, fontWeight: '800' }}>Meal</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {mealTypes.map((meal) => {
                    const isSelected = mealType === meal.value;

                    return (
                      <Pressable
                        key={meal.value}
                        onPress={() => setMealType(meal.value)}
                        style={{
                          borderRadius: 999,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          backgroundColor: isSelected ? '#0f172a' : '#e2e8f0',
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? '#ffffff' : '#0f172a',
                            fontWeight: '800',
                          }}
                        >
                          {meal.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>

              <Card>
                <Text style={{ fontSize: 18, fontWeight: '800' }}>Food search</Text>
                <TextInput
                  value={searchQuery}
                  onChangeText={(value) => {
                    setSearchQuery(value);
                    setSelectedFood(null);
                    setNewFoodName(value);
                  }}
                  placeholder="Search food name..."
                  autoCapitalize="words"
                  style={{ ...inputStyle(), marginTop: 12 }}
                />
                <Text style={{ marginTop: 8, color: '#64748b' }}>
                  {isSearching ? 'Searching foods...' : 'Search public.foods by name.'}
                </Text>

                {foodResults.length > 0 ? (
                  <View style={{ gap: 8, marginTop: 12 }}>
                    {foodResults.map((food) => {
                      const isSelected = selectedFood?.id === food.id;

                      return (
                        <Pressable
                          key={food.id}
                          onPress={() => chooseFood(food)}
                          style={{
                            borderWidth: 1,
                            borderColor: isSelected ? '#0f172a' : '#e2e8f0',
                            borderRadius: 12,
                            padding: 12,
                            backgroundColor: isSelected ? '#f1f5f9' : '#ffffff',
                          }}
                        >
                          <Text style={{ fontWeight: '900' }}>{food.name}</Text>
                          <Text style={{ marginTop: 4, color: '#64748b' }}>
                            {Math.round(food.calories)} kcal · P {formatMacro(food.proteinG)}g · C{' '}
                            {formatMacro(food.carbsG)}g · F {formatMacro(food.fatG)}g
                          </Text>
                          <Text style={{ marginTop: 4, color: '#64748b' }}>
                            Per {formatMacro(food.servingSize ?? 1)} {food.servingUnit ?? 'serving'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </Card>

              {searchQuery.trim() ? (
                <Card>
                  <Text style={{ fontSize: 18, fontWeight: '800' }}>Create new food</Text>
                  <Text style={{ marginTop: 8, color: '#64748b' }}>
                    Use this fallback if the food is not in search results.
                  </Text>
                  <View style={{ gap: 10, marginTop: 12 }}>
                    <TextInput
                      value={newFoodName}
                      onChangeText={setNewFoodName}
                      placeholder="Food name"
                      style={inputStyle()}
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TextInput
                        value={servingSize}
                        onChangeText={setServingSize}
                        keyboardType="numeric"
                        placeholder="Serving size"
                        style={{ ...inputStyle(), flex: 1 }}
                      />
                      <TextInput
                        value={servingUnit}
                        onChangeText={setServingUnit}
                        placeholder="Unit"
                        style={{ ...inputStyle(), flex: 1 }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TextInput
                        value={calories}
                        onChangeText={setCalories}
                        keyboardType="numeric"
                        placeholder="Calories"
                        style={{ ...inputStyle(), flex: 1 }}
                      />
                      <TextInput
                        value={protein}
                        onChangeText={setProtein}
                        keyboardType="numeric"
                        placeholder="Protein"
                        style={{ ...inputStyle(), flex: 1 }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TextInput
                        value={carbs}
                        onChangeText={setCarbs}
                        keyboardType="numeric"
                        placeholder="Carbs"
                        style={{ ...inputStyle(), flex: 1 }}
                      />
                      <TextInput
                        value={fat}
                        onChangeText={setFat}
                        keyboardType="numeric"
                        placeholder="Fat"
                        style={{ ...inputStyle(), flex: 1 }}
                      />
                    </View>
                    <Button title="Create new food" onPress={() => void handleCreateFood()} />
                  </View>
                </Card>
              ) : null}

              <Card>
                <Text style={{ fontSize: 18, fontWeight: '800' }}>Quantity</Text>
                {selectedFood ? (
                  <Text style={{ marginTop: 8, color: '#64748b' }}>
                    Selected: {selectedFood.name}
                  </Text>
                ) : (
                  <Text style={{ marginTop: 8, color: '#64748b' }}>
                    Select or create a food first.
                  </Text>
                )}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TextInput
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    placeholder="Quantity"
                    style={{ ...inputStyle(), flex: 1 }}
                  />
                  <TextInput
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="Unit"
                    style={{ ...inputStyle(), flex: 1 }}
                  />
                </View>
              </Card>

              <View style={{ gap: 10 }}>
                <Button title="Log food" onPress={() => void handleLogFood()} disabled={!selectedFood} />
                <Button
                  title="Cancel"
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
