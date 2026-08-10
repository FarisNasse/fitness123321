import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

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
  deleteLocalMealItem,
  deleteLocalWaterLog,
  getDailyNutritionSummary,
  getAllowedFoodLogUnits,
  getDefaultFoodLogAmount,
  getFoodSourceLabel,
  getRecentFoods,
  hydrateFoodDetails,
  isValidFoodBarcode,
  normalizeFoodBarcode,
  searchFoodByBarcode,
  searchFoodsByName,
  subscribeToNutritionLogChanges,
  syncPendingNutritionLogs,
  updateLocalMealItemQuantity,
  type DailyNutritionSummary,
} from '@/src/features/nutrition/nutrition-service';
import { reportError } from '@/src/lib/error-reporting';
import { useModalFocusTrap } from '@/src/lib/use-modal-focus-trap';
import type { Food, MealType } from '@/src/types/models';

const mealTypes: { label: string; value: MealType }[] = [
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Snack', value: 'snack' },
];

const waterPresets = [250, 500, 750];
const SEARCH_PAGE_SIZE = 25;

function getQuantityStep(unit: string | null | undefined) {
  const normalized = (unit ?? '').trim().toLowerCase();
  if (normalized === 'g' || normalized === 'gram' || normalized === 'grams') return 10;
  if (normalized === 'ml' || normalized === 'milliliter' || normalized === 'milliliters') return 25;
  if (normalized === 'lb' || normalized === 'pound' || normalized === 'pounds') return 0.1;
  if (normalized === 'oz' || normalized === 'ounce' || normalized === 'ounces') return 0.25;
  return 0.25;
}

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

function formatMacro(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatCalories(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : String(Math.round(value));
}

function progress(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(1, current / target);
}

export default function NutritionScreen() {
  const { session } = useAuthSession();
  const ownerId = session?.user.id ?? null;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const scannerConsumedRef = useRef(false);
  const [summary, setSummary] = useState<DailyNutritionSummary>(emptySummary);
  const [isAddFoodOpen, setIsAddFoodOpen] = useState(false);
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [searchQuery, setSearchQuery] = useState('');
  const [foodResults, setFoodResults] = useState<Food[]>([]);
  const [recentFoods, setRecentFoods] = useState<Food[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreFoods, setHasMoreFoods] = useState(false);
  const [nextSearchOffset, setNextSearchOffset] = useState(SEARCH_PAGE_SIZE);
  const [isHydratingFood, setIsHydratingFood] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchGenerationRef = useRef(0);
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [barcodeStatus, setBarcodeStatus] = useState<string | null>(null);
  const [isBarcodeSearching, setIsBarcodeSearching] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('serving');
  const [newFoodName, setNewFoodName] = useState('');
  const [servingSize, setServingSize] = useState('1');
  const [servingUnit, setServingUnit] = useState('serving');
  const [calories, setCalories] = useState('0');
  const [protein, setProtein] = useState('0');
  const [carbs, setCarbs] = useState('0');
  const [fat, setFat] = useState('0');
  const addFoodModalRef = useModalFocusTrap(isAddFoodOpen);
  const barcodeModalRef = useModalFocusTrap(isBarcodeScannerOpen);

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
    const trimmed = searchQuery.trim();

    searchAbortRef.current?.abort();
    const generation = ++searchGenerationRef.current;

    if (trimmed.length < 2) {
      setFoodResults([]);
      setIsSearching(false);
      setHasMoreFoods(false);
      setNextSearchOffset(SEARCH_PAGE_SIZE);
      return undefined;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;
    const timer = setTimeout(() => {
      setIsSearching(true);

      void searchFoodsByName(trimmed, {
        limit: SEARCH_PAGE_SIZE,
        offset: 0,
        signal: controller.signal,
      })
        .then((foods) => {
          if (generation !== searchGenerationRef.current || controller.signal.aborted) return;
          setFoodResults(foods);
          setHasMoreFoods(foods.filter((food) => food.source !== 'custom').length >= SEARCH_PAGE_SIZE);
          setNextSearchOffset(SEARCH_PAGE_SIZE);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          reportError(error, {
            source: 'nutrition-screen',
            operation: 'search-foods',
            domain: 'nutrition',
          });
          Alert.alert('Unable to search foods', 'Food search is temporarily unavailable.');
        })
        .finally(() => {
          if (generation === searchGenerationRef.current && !controller.signal.aborted) {
            setIsSearching(false);
          }
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    if (isAddFoodOpen) {
      setRecentFoods(getRecentFoods(ownerId ?? undefined));
    }
  }, [isAddFoodOpen, ownerId]);

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

  const customFoodResults = useMemo(
    () => foodResults.filter((food) => food.source === 'custom'),
    [foodResults]
  );
  const catalogFoodResults = useMemo(
    () => foodResults.filter((food) => food.source !== 'custom'),
    [foodResults]
  );

  const hasFoodEntries = summary.entries.length > 0;
  const calorieProgress = progress(summary.totals.calories, DEFAULT_DAILY_TARGETS.calories);
  const proteinProgress = progress(summary.totals.proteinG, DEFAULT_DAILY_TARGETS.proteinG);
  const waterProgress = progress(summary.totals.waterMl, DEFAULT_DAILY_TARGETS.waterMl);

  function resetAddFoodForm() {
    setMealType('breakfast');
    setSearchQuery('');
    setFoodResults([]);
    setRecentFoods([]);
    setSelectedFood(null);
    setBarcodeQuery('');
    setBarcodeStatus(null);
    setIsBarcodeSearching(false);
    setIsBarcodeScannerOpen(false);
    setScannerMessage(null);
    scannerConsumedRef.current = false;
    setIsSearching(false);
    setIsLoadingMore(false);
    setHasMoreFoods(false);
    setNextSearchOffset(SEARCH_PAGE_SIZE);
    searchAbortRef.current?.abort();
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

  async function chooseFood(food: Food) {
    setIsHydratingFood(true);
    try {
      const hydrated = await hydrateFoodDetails(food);
      const defaultAmount = getDefaultFoodLogAmount(hydrated);
      setSelectedFood(hydrated);
      setFoodResults((current) =>
        current.map((item) => (item.id === food.id ? hydrated : item))
      );
      setUnit(defaultAmount.unit);
      setQuantity(String(defaultAmount.quantity));
    } catch (error) {
      reportError(error, {
        source: 'nutrition-screen',
        operation: 'hydrate-food-details',
        domain: 'nutrition',
      });
      Alert.alert(
        'Unable to load food details',
        'The complete USDA nutrition record is required before this food can be logged.'
      );
    } finally {
      setIsHydratingFood(false);
    }
  }

  async function handleLoadMoreFoods() {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2 || isLoadingMore || !hasMoreFoods) return;

    const generation = searchGenerationRef.current;
    setIsLoadingMore(true);
    try {
      const foods = await searchFoodsByName(trimmed, {
        limit: SEARCH_PAGE_SIZE,
        offset: nextSearchOffset,
      });
      if (generation !== searchGenerationRef.current) return;
      setFoodResults((current) => {
        const seen = new Set(current.map((food) => food.id));
        return [...current, ...foods.filter((food) => !seen.has(food.id))];
      });
      setHasMoreFoods(foods.filter((food) => food.source !== 'custom').length >= SEARCH_PAGE_SIZE);
      setNextSearchOffset((current) => current + SEARCH_PAGE_SIZE);
    } catch (error) {
      reportError(error, {
        source: 'nutrition-screen', operation: 'load-more-foods', domain: 'nutrition',
      });
      Alert.alert('Unable to load more foods', 'More results could not be loaded.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleBarcodeLookup(rawInput = barcodeQuery) {
    const barcode = normalizeFoodBarcode(rawInput);

    if (!barcode || !isValidFoodBarcode(barcode)) {
      setBarcodeStatus('Enter a valid GTIN-8, UPC-A/GTIN-12, EAN-13, or GTIN-14 with a correct check digit.');
      return;
    }

    searchAbortRef.current?.abort();
    ++searchGenerationRef.current;
    setIsSearching(false);
    setHasMoreFoods(false);
    setNextSearchOffset(SEARCH_PAGE_SIZE);
    setBarcodeStatus(null);
    setIsBarcodeSearching(true);

    try {
      const matches = await searchFoodByBarcode(barcode);
      setFoodResults(matches);

      if (matches.length === 0) {
        setSelectedFood(null);
        setBarcodeStatus('Product not found. Search by name or create a custom food.');
        return;
      }

      if (matches.length === 1) {
        await chooseFood(matches[0]);
        setBarcodeStatus(`Matched ${matches[0].name}.`);
      } else {
        setSelectedFood(null);
        setBarcodeStatus(`${matches.length} product versions found. Choose the correct record below.`);
      }
    } catch (error) {
      reportError(error, {
        source: 'nutrition-screen',
        operation: 'search-food-barcode',
        domain: 'nutrition',
      });
      setBarcodeStatus('Barcode lookup is temporarily unavailable.');
    } finally {
      setIsBarcodeSearching(false);
    }
  }

  async function openBarcodeScanner() {
    try {
      let permission = cameraPermission;
      if (!permission?.granted) {
        permission = await requestCameraPermission();
      }
      if (!permission.granted) {
        Alert.alert(
          'Camera permission required',
          'Allow camera access to scan food barcodes. Manual barcode entry remains available.'
        );
        return;
      }
      scannerConsumedRef.current = false;
      setScannerMessage('Point the camera at a UPC, EAN, GTIN, QR, or GS1 Data Matrix code.');
      setIsBarcodeScannerOpen(true);
    } catch (error) {
      reportError(error, {
        source: 'nutrition-screen', operation: 'request-camera-permission', domain: 'nutrition',
      });
      Alert.alert('Unable to open scanner', 'Camera access could not be started.');
    }
  }

  async function handleScannedBarcode(data: string) {
    if (scannerConsumedRef.current) return;
    const barcode = normalizeFoodBarcode(data);
    if (!barcode || !isValidFoodBarcode(barcode)) {
      setScannerMessage('A code was detected, but it did not contain a valid retail GTIN. Try another code.');
      return;
    }

    scannerConsumedRef.current = true;
    setBarcodeQuery(barcode);
    setIsBarcodeScannerOpen(false);
    setScannerMessage(null);
    await handleBarcodeLookup(barcode);
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

    if (barcodeQuery.trim() && !isValidFoodBarcode(barcodeQuery)) {
      Alert.alert(
        'Invalid barcode',
        'Use a valid GTIN-8, UPC-A/GTIN-12, EAN-13, or GTIN-14 with a correct check digit.'
      );
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
        barcode: barcodeQuery.trim() ? barcodeQuery.trim() : undefined,
      });

      setFoodResults((current) => [food, ...current.filter((item) => item.id !== food.id)]);
      await chooseFood(food);
      setSearchQuery(food.name);
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

  function queueNutritionSync(operation: string) {
    void syncPendingNutritionLogs().catch((error) => {
      reportError(error, { source: 'nutrition-screen', operation, domain: 'nutrition' });
    });
  }

  function handleAdjustFoodQuantity(entry: DailyNutritionSummary['entries'][number], delta: number) {
    try {
      if (!ownerId) throw new Error('A signed-in nutrition owner is required.');
      const nextQuantity = Math.max(0.01, Number(entry.quantity) + delta);
      updateLocalMealItemQuantity({
        userId: ownerId,
        mealItemLocalId: entry.local_id,
        quantity: Number(nextQuantity.toFixed(2)),
      });
      refreshSummary();
      queueNutritionSync('sync-after-food-correction');
    } catch (error) {
      reportError(error, { source: 'nutrition-screen', operation: 'correct-food-log', domain: 'nutrition' });
      Alert.alert('Unable to update food', 'The food quantity could not be updated.');
    }
  }

  function handleDeleteFood(entry: DailyNutritionSummary['entries'][number]) {
    if (!ownerId) return;
    Alert.alert(
      'Delete food entry?',
      `Remove ${entry.food_name} from today's log?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              if (!deleteLocalMealItem(ownerId, entry.local_id)) return;
              refreshSummary();
              queueNutritionSync('sync-after-food-delete');
            } catch (error) {
              reportError(error, { source: 'nutrition-screen', operation: 'delete-food-log', domain: 'nutrition' });
              Alert.alert('Unable to delete food', 'The food entry could not be deleted.');
            }
          },
        },
      ]
    );
  }

  function handleDeleteWater(localId: string, amountMl: number) {
    if (!ownerId) return;
    Alert.alert(
      'Delete water entry?',
      `Remove ${amountMl} ml from today's water log?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              if (!deleteLocalWaterLog(ownerId, localId)) return;
              refreshSummary();
              queueNutritionSync('sync-after-water-delete');
            } catch (error) {
              reportError(error, { source: 'nutrition-screen', operation: 'delete-water-log', domain: 'nutrition' });
              Alert.alert('Unable to delete water', 'The water entry could not be deleted.');
            }
          },
        },
      ]
    );
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
          <Button
            title="Add food"
            onPress={() => {
              setRecentFoods(getRecentFoods(ownerId ?? undefined));
              setIsAddFoodOpen(true);
            }}
          />
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
                accessibilityRole="button"
                accessibilityLabel={`Add ${amountMl} milliliters of water`}
                className="min-h-11 rounded-pill border border-info bg-info/20 px-4 py-3 active:opacity-75"
              >
                <Text className="text-sm font-bold text-info">+{amountMl} ml</Text>
              </Pressable>
            ))}
          </View>
          {summary.waterLogs.length > 0 ? (
            <View className="gap-2 border-t border-base-300 pt-3">
              {summary.waterLogs.map((waterLog) => (
                <View key={waterLog.local_id} className="flex-row items-center justify-between gap-3">
                  <Text className="flex-1 text-sm font-body text-base-muted">
                    {Number(waterLog.amount_ml)} ml
                  </Text>
                  <Pressable
                    onPress={() => handleDeleteWater(waterLog.local_id, Number(waterLog.amount_ml))}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${Number(waterLog.amount_ml)} milliliter water entry`}
                    className="min-h-11 justify-center rounded-pill border border-error/40 px-3"
                  >
                    <Text className="text-sm font-bold text-error">Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
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
                        <View className="flex-row flex-wrap gap-2 pt-2">
                          <Pressable
                            onPress={() => handleAdjustFoodQuantity(entry, -getQuantityStep(entry.unit))}
                            accessibilityRole="button"
                            accessibilityLabel={`Decrease ${entry.food_name} quantity`}
                            className="min-h-11 min-w-11 items-center justify-center rounded-pill border border-base-300 px-3"
                          >
                            <Text className="text-base font-bold text-base-content">−</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleAdjustFoodQuantity(entry, getQuantityStep(entry.unit))}
                            accessibilityRole="button"
                            accessibilityLabel={`Increase ${entry.food_name} quantity`}
                            className="min-h-11 min-w-11 items-center justify-center rounded-pill border border-base-300 px-3"
                          >
                            <Text className="text-base font-bold text-base-content">+</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteFood(entry)}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${entry.food_name} entry`}
                            className="min-h-11 justify-center rounded-pill border border-error/40 px-3"
                          >
                            <Text className="text-sm font-bold text-error">Delete</Text>
                          </Pressable>
                        </View>
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
        <View ref={addFoodModalRef} tabIndex={-1} accessibilityRole="dialog" className="flex-1 bg-base-100" accessibilityViewIsModal>
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
                        accessibilityRole="button"
                        accessibilityLabel={`${meal.label} meal`}
                        accessibilityState={{ selected: isSelected }}
                        className={`min-h-11 rounded-pill border px-4 py-3 ${
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
                  {isSearching
                    ? 'Searching foods...'
                    : searchQuery.trim().length === 1
                      ? 'Type at least 2 characters to search.'
                      : 'Search the catalog. Previously used foods remain available offline.'}
                </Text>

                {searchQuery.trim().length < 2 && recentFoods.length > 0 ? (
                  <View className="gap-2">
                    <Text className="text-xs font-bold uppercase tracking-widest text-base-muted">
                      Recent
                    </Text>
                    {recentFoods.map((food) => (
                      <FoodSearchResult
                        key={`recent-${food.id}`}
                        food={food}
                        selected={selectedFood?.id === food.id}
                        onPress={() => void chooseFood(food)}
                      />
                    ))}
                  </View>
                ) : null}

                {customFoodResults.length > 0 ? (
                  <View className="gap-2">
                    <Text className="text-xs font-bold uppercase tracking-widest text-base-muted">
                      Your foods
                    </Text>
                    {customFoodResults.map((food) => (
                      <FoodSearchResult
                        key={`custom-${food.id}`}
                        food={food}
                        selected={selectedFood?.id === food.id}
                        onPress={() => void chooseFood(food)}
                      />
                    ))}
                  </View>
                ) : null}

                {catalogFoodResults.length > 0 ? (
                  <View className="gap-2">
                    <Text className="text-xs font-bold uppercase tracking-widest text-base-muted">
                      USDA results
                    </Text>
                    {catalogFoodResults.map((food) => (
                      <FoodSearchResult
                        key={`catalog-${food.id}`}
                        food={food}
                        selected={selectedFood?.id === food.id}
                        onPress={() => void chooseFood(food)}
                      />
                    ))}
                  </View>
                ) : null}

                {searchQuery.trim().length >= 2 && !isSearching && foodResults.length === 0 ? (
                  <EmptyState
                    title="No foods found"
                    message="Try another name, scan/enter a barcode, or create a custom food."
                  />
                ) : null}

                {foodResults.length > 0 && hasMoreFoods ? (
                  <Button
                    title={isLoadingMore ? 'Loading more...' : 'Load more'}
                    variant="ghost"
                    onPress={() => void handleLoadMoreFoods()}
                    disabled={isLoadingMore}
                  />
                ) : null}
              </Card>

              <Card className="gap-3">
                <Text className="text-xl font-bold text-base-content">Barcode lookup</Text>
                <Text className="text-sm font-body leading-6 text-base-muted">
                  Enter a retail GTIN for an exact branded-product match. Check digits and equivalent zero-padded forms are validated.
                </Text>
                <Input
                  value={barcodeQuery}
                  onChangeText={(value) => {
                    setBarcodeQuery(value);
                    setBarcodeStatus(null);
                  }}
                  keyboardType="numeric"
                  placeholder="UPC / EAN barcode"
                />
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      title="Scan barcode"
                      variant="ghost"
                      onPress={() => void openBarcodeScanner()}
                      disabled={isBarcodeSearching}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      title={isBarcodeSearching ? 'Looking up...' : 'Look up barcode'}
                      onPress={() => void handleBarcodeLookup()}
                      disabled={isBarcodeSearching}
                    />
                  </View>
                </View>
                {barcodeStatus ? (
                  <Text className="text-sm font-body text-base-muted">{barcodeStatus}</Text>
                ) : null}
              </Card>

              {searchQuery.trim() || barcodeQuery.trim() ? (
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
                  <View className="gap-1">
                    <Text className="text-base font-bold text-base-content">
                      {selectedFood.name}
                    </Text>
                    <Text className="text-sm font-body text-base-muted">
                      {getFoodSourceLabel(selectedFood)}
                      {selectedFood.brand ? ` · ${selectedFood.brand}` : ''}
                    </Text>
                    <Text className="text-sm font-body text-base-muted">
                      {formatCalories(selectedFood.calories)} kcal · P {formatMacro(selectedFood.proteinG)}g · C{' '}
                      {formatMacro(selectedFood.carbsG)}g · F {formatMacro(selectedFood.fatG)}g
                    </Text>
                    {selectedFood.fiberG != null || selectedFood.sodiumMg != null ? (
                      <Text className="text-sm font-body text-base-muted">
                        {selectedFood.fiberG != null
                          ? `Fiber ${formatMacro(selectedFood.fiberG)}g`
                          : 'Fiber not reported'}
                        {' · '}
                        {selectedFood.sodiumMg != null
                          ? `Sodium ${formatMacro(selectedFood.sodiumMg)}mg`
                          : 'Sodium not reported'}
                      </Text>
                    ) : null}
                  </View>
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
                  <View className="flex-1 flex-row flex-wrap gap-2">
                    {(selectedFood ? getAllowedFoodLogUnits(selectedFood) : ['serving']).map((option) => (
                      <Pressable
                        key={option}
                        onPress={() => setUnit(option)}
                        className={`rounded-pill border px-3 py-3 ${
                          unit === option ? 'border-primary bg-primary' : 'border-base-300 bg-base-100'
                        }`}
                      >
                        <Text className={unit === option ? 'font-bold text-primary-content' : 'font-bold text-base-content'}>
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </Card>

              <View className="gap-3">
                <Button title="Log food" onPress={() => void handleLogFood()} disabled={!selectedFood || isHydratingFood} />
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
      <Modal
        visible={isBarcodeScannerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsBarcodeScannerOpen(false)}
      >
        <View ref={barcodeModalRef} tabIndex={-1} accessibilityRole="dialog" className="flex-1 bg-base-100" accessibilityViewIsModal>
          <View className="flex-row items-center justify-between gap-3 px-5 pb-3 pt-6">
            <View className="flex-1">
              <Text className="text-xl font-bold text-base-content">Scan food barcode</Text>
              <Text className="mt-1 text-sm font-body text-base-muted">
                {scannerMessage ?? 'Align the barcode inside the camera view.'}
              </Text>
            </View>
            <Button title="Close" variant="ghost" onPress={() => setIsBarcodeScannerOpen(false)} />
          </View>
          <View className="mx-5 mb-5 flex-1 overflow-hidden rounded-3xl bg-base-200">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'datamatrix', 'qr'],
              }}
              onBarcodeScanned={({ data }) => void handleScannedBarcode(data)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function FoodSearchResult({
  food,
  selected,
  onPress,
}: {
  food: Food;
  selected: boolean;
  onPress: () => void;
}) {
  const basis = `${formatMacro(food.nutritionBasisSize ?? food.servingSize ?? 1)} ${food.nutritionBasisUnit ?? food.servingUnit ?? 'serving'}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${food.name}, ${formatCalories(food.calories)} calories`}
      accessibilityState={{ selected }}
      className={`min-h-11 gap-1 rounded-card border p-3 ${
        selected ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-100'
      }`}
    >
      <Text className="text-base font-bold text-base-content">{food.name}</Text>
      <Text className="text-xs font-bold uppercase tracking-wide text-base-muted">
        {getFoodSourceLabel(food)}{food.brand ? ` · ${food.brand}` : ''}
      </Text>
      <Text className="text-sm font-body text-base-muted">
        Nutrition per {basis} · {formatCalories(food.calories)} kcal
      </Text>
      <Text className="text-sm font-body text-base-muted">
        P {formatMacro(food.proteinG)}g · C {formatMacro(food.carbsG)}g · F {formatMacro(food.fatG)}g
      </Text>
      {food.barcode || food.publicationDate ? (
        <Text className="text-xs font-body text-base-muted">
          {food.barcode ? `GTIN ${food.barcode}` : ''}
          {food.barcode && food.publicationDate ? ' · ' : ''}
          {food.publicationDate ? `Published ${food.publicationDate}` : ''}
        </Text>
      ) : null}
    </Pressable>
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
