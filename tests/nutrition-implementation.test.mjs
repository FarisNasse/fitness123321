import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWhitespace, readProjectFile } from './helpers/project.mjs';

test('nutrition tab wires add-food modal, daily macro totals, grouped meals, and water quick-add', () => {
  const screen = readProjectFile('app/(tabs)/nutrition.tsx');

  assert.match(screen, /getDailyNutritionSummary\(ownerId\)/);
  assert.match(screen, /<MetricCard label="Calories" value=\{String\(summary\.totals\.calories\)\}/);
  assert.match(screen, /<MetricCard label="Protein" value=\{`\$\{formatMacro\(summary\.totals\.proteinG\)\}g`\}/);
  assert.match(screen, /title="Add food"[\s\S]*setIsAddFoodOpen\(true\)/);
  assert.match(screen, /<Modal[\s\S]*visible=\{isAddFoodOpen\}[\s\S]*Choose a meal, select or create a food/s);
  assert.match(screen, /searchFoodsByName\(searchQuery\)/);
  assert.match(screen, /Create new food/);
  assert.match(screen, /createFood\(\{/);
  assert.match(screen, /addLocalMealItem\(\{/);
  assert.match(screen, /mealType,/);
  assert.match(screen, /quantity: parsedQuantity/);
  assert.match(screen, /entriesByMealType\[meal\.value\]/);
  assert.match(screen, /waterPresets = \[250, 500, 750\]/);
  assert.match(screen, /addLocalWaterLog\(\{ userId: ownerId, amountMl \}\)/);
});

test('nutrition food result card keeps source, brand, and macro JSX valid', () => {
  const screen = readProjectFile('app/(tabs)/nutrition.tsx');

  assert.doesNotMatch(screen, /forod\./);
  assert.match(
    screen,
    /\{getFoodSourceLabel\(food\)\}\{food\.brand \? ` · \$\{food\.brand\}` : ''\}/
  );
  assert.match(
    screen,
    /P \{formatMacro\(food\.proteinG\)\}g · C \{formatMacro\(food\.carbsG\)\}g · F \{formatMacro\(food\.fatG\)\}g/
  );
});

test('nutrition service supports USDA catalog search, exact barcode lookup, custom foods, local snapshots, and legacy fallback', () => {
  const service = readProjectFile('src/features/nutrition/nutrition-service.ts');

  assert.match(service, /export async function searchFoodsByName\(/);
  assert.match(service, /supabase\.rpc\('search_food_catalog'/);
  assert.match(service, /result_limit: limit/);
  assert.match(service, /result_offset: offset/);
  assert.match(service, /supabase\.functions\.invoke\('search-usda-foods'/);
  assert.match(service, /searchFoodDataCentral\(\{/);
  assert.match(service, /apiKey: 'DEMO_KEY'/);
  assert.match(service, /USE_USDA_FOOD_CATALOG && !HAS_REMOTE_SUPABASE_CONFIG/);
  assert.match(service, /mergeFoodResults\(customFoods, catalogFoods, liveUsdaFoods\)/);
  assert.match(service, /\.from\('user_foods'\)/);
  assert.match(service, /export async function searchFoodByBarcode/);
  assert.match(service, /supabase\.rpc\('search_food_by_barcode'/);
  assert.match(service, /export function normalizeFoodBarcode/);
  assert.match(service, /\.from\('foods'\)[\s\S]*\.select\(LEGACY_FOOD_SELECT\)/s);
  assert.match(service, /export async function createFood/);
  assert.match(service, /\.from\('user_foods'\)[\s\S]*\.insert\(foodPayload\)/s);
  assert.match(service, /export function addLocalMealItem/);
  assert.match(service, /insert into meal_items_local \([\s\S]*food_source,[\s\S]*source_food_id,[\s\S]*fdc_id,[\s\S]*fiber_g,[\s\S]*sodium_mg/s);
  assert.match(service, /const legacyFoodId = input\.food\.source === 'legacy' \? input\.food\.id : null/);
  assert.match(service, /cacheFoodLocally\(input\.food, now\)/);
  assert.match(service, /recordFoodCatalogUse\(input\.food\)/);
  assert.match(service, /export function getDailyNutritionSummary/);
  assert.match(service, /export function syncPendingNutritionLogs\(\)/);
  assert.match(service, /food_source: item\.food_source/);
  assert.match(service, /\.from\('meal_items'\)[\s\S]*\.upsert\(itemRows, \{ onConflict: 'id' \}\)/);
});

test('local-db web adapter supports the nutrition query and mutation patterns used by the service', () => {
  const localDb = normalizeWhitespace(readProjectFile('src/lib/local-db.ts'));

  assert.match(localDb, /insert into meal_logs_local/);
  assert.match(localDb, /insert into meal_items_local/);
  assert.match(localDb, /insert into water_logs_local/);
  assert.match(localDb, /insert into food_cache_local/);
  assert.match(localDb, /from food_cache_local.*lower\(name\) like \?/);
  assert.match(localDb, /from food_cache_local.*barcode = \?/);
  assert.match(localDb, /update meal_logs_local.*set sync_status = 'failed'/);
  assert.match(localDb, /update meal_logs_local.*set server_id = \?/);
  assert.match(localDb, /update meal_logs_local.*set server_id = null/);
  assert.match(localDb, /update meal_items_local.*set sync_status = 'failed'/);
  assert.match(localDb, /update meal_items_local.*set server_id = \?/);
  assert.match(localDb, /update water_logs_local.*set sync_status = 'failed'/);
  assert.match(localDb, /update water_logs_local.*set server_id = \?/);
  assert.match(localDb, /from meal_logs_local.*sync_status/);
  assert.match(localDb, /from meal_logs_local.*logged_at >= \?.*logged_at < \?/);
  assert.match(localDb, /from meal_items_local.*meal_log_local_id in/);
  assert.match(localDb, /from meal_items_local.*meal_log_local_id = \?/);
  assert.match(localDb, /from water_logs_local.*sync_status/);
  assert.match(localDb, /from water_logs_local.*logged_at >= \?.*logged_at < \?/);
});

test('shared sync state coordinates the nutrition queue on connectivity and app activation', () => {
  const syncState = readProjectFile('src/lib/sync-state.tsx');

  assert.match(syncState, /import \{ syncPendingNutritionLogs \} from '@\/src\/features\/nutrition\/nutrition-service';/);
  assert.match(syncState, /nutrition: syncPendingNutritionLogs/);
  assert.match(syncState, /if \(ownerId && canSync && networkStatus === 'online'\)/);
  assert.match(syncState, /AppState\.addEventListener\(\s*'change'/s);
  assert.match(syncState, /if \(state === 'active'\)/);
});

test('runtime flags make USDA the default food source while keeping other domains local-first', () => {
  const flags = readProjectFile('src/lib/runtime-flags.ts');

  assert.match(flags, /EXPO_PUBLIC_NUTRITION_SYNC_SOURCE === 'supabase'/);
  assert.match(flags, /export const HAS_REMOTE_SUPABASE_CONFIG = Boolean/);
  assert.match(flags, /export const FOOD_SOURCE = process\.env\.EXPO_PUBLIC_FOOD_SOURCE \?\? 'usda'/);
  assert.match(flags, /export const USE_USDA_FOOD_CATALOG = FOOD_SOURCE === 'usda'/);
  assert.match(flags, /export const ALLOW_USDA_DEMO_FALLBACK = APP_ENV !== 'production'/);
  assert.match(flags, /USE_SUPABASE_FOODS =[\s\S]*FOOD_SOURCE === 'supabase'[\s\S]*USE_USDA_FOOD_CATALOG/);
});


test('daily targets stay local by default instead of warning about missing Supabase auth', () => {
  const service = readProjectFile('src/features/nutrition/nutrition-service.ts');

  assert.match(service, /export async function getDailyTargets\(\): Promise<DailyTargetsState> \{\s*if \(!USE_REMOTE_NUTRITION_SYNC\) \{\s*return \{ targets: DEFAULT_DAILY_TARGETS, hasRemoteTargets: false \};\s*\}/s);
});

test('dashboard reads live nutrition totals and daily targets alongside persisted wellness steps', () => {
  const dashboard = readProjectFile('app/(tabs)/dashboard.tsx');

  assert.match(dashboard, /useFocusEffect/);
  assert.match(dashboard, /getDailyNutritionSummary\(ownerId\)/);
  assert.match(dashboard, /getDailyTargets\(\)/);
  assert.match(dashboard, /subscribeToNutritionLogChanges\(ownerId, refreshSummary\)/);
  assert.match(dashboard, /DEFAULT_DAILY_TARGETS/);
  assert.match(dashboard, /Today's baseline/);
  assert.match(dashboard, /<MetricCard\s+label="Calories"[\s\S]*summary\.totals\.calories[\s\S]*targets\.calories/);
  assert.match(dashboard, /<MetricCard\s+label="Protein"[\s\S]*summary\.totals\.proteinG[\s\S]*targets\.proteinG/);
  assert.match(dashboard, /<MetricCard label="Water" value=\{`\$\{waterLoggedLabel\}L \/ \$\{waterTargetLabel\}L`\}/);
  assert.match(dashboard, /getDailyWellnessCheckIn\(ownerId\)/);
  assert.match(dashboard, /subscribeToWellnessChanges/);
  assert.match(dashboard, /value=\{`\$\{formatWholeNumber\(steps\)\} \/ \$\{formatWholeNumber\(targets\.steps\)\}`\}/);
  assert.match(dashboard, /<ChecklistItem label="Log a meal" done=\{summary\.entries\.length > 0\} \/>/);
  assert.match(dashboard, /<ChecklistItem label="Drink water" done=\{summary\.totals\.waterMl > 0\} \/>/);
  assert.match(dashboard, /<ChecklistItem label="Record activity" done=\{steps > 0\} \/>/);
});

test('nutrition service exposes daily target defaults, Supabase daily_targets fetch, and a log-change event emitter', () => {
  const service = readProjectFile('src/features/nutrition/nutrition-service.ts');

  assert.match(service, /export const DEFAULT_DAILY_TARGETS/);
  assert.match(service, /calories: 2000/);
  assert.match(service, /proteinG: 135/);
  assert.match(service, /waterMl: 2000/);
  assert.match(service, /steps: 8000/);
  assert.match(service, /export async function getDailyTargets\(\): Promise<DailyTargetsState>/);
  assert.match(service, /\.from\('daily_targets'\)\s*\.select\('calories, protein_g, carbs_g, fat_g, water_ml, steps'\)\s*\.eq\('user_id', authData\.user\.id\)\s*\.maybeSingle\(\)/s);
  assert.match(service, /return mapDailyTargets\(data as DailyTargetsRow \| null\)/);
  assert.match(service, /const nutritionLogListeners = new Set<NutritionLogListener>\(\)/);
  assert.match(service, /export function subscribeToNutritionLogChanges\(userId: string, listener: \(\) => void\)/);
  assert.match(service, /function notifyNutritionLogChanged\(userId: string\)/);
  assert.match(service, /insert into meal_items_local[\s\S]*notifyNutritionLogChanged\(input\.userId\);/);
  assert.match(service, /insert into water_logs_local[\s\S]*notifyNutritionLogChanged\(input\.userId\);/);
});
