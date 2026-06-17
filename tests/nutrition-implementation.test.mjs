import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWhitespace, readProjectFile } from './helpers/project.mjs';

test('nutrition tab wires add-food modal, daily macro totals, grouped meals, and water quick-add', () => {
  const screen = readProjectFile('app/(tabs)/nutrition.tsx');

  assert.match(screen, /getDailyNutritionSummary\(\)/);
  assert.match(screen, /<MetricCard label="Calories" value=\{String\(summary\.totals\.calories\)\}/);
  assert.match(screen, /<MetricCard label="Protein" value=\{`\$\{formatMacro\(summary\.totals\.proteinG\)\}g`\}/);
  assert.match(screen, /<Button title="Add food" onPress=\{\(\) => setIsAddFoodOpen\(true\)\} \/>/);
  assert.match(screen, /<Modal[\s\S]*visible=\{isAddFoodOpen\}[\s\S]*Choose a meal, select or create a food/s);
  assert.match(screen, /searchFoodsByName\(searchQuery\)/);
  assert.match(screen, /Create new food/);
  assert.match(screen, /createFood\(\{/);
  assert.match(screen, /addLocalMealItem\(\{/);
  assert.match(screen, /mealType,/);
  assert.match(screen, /quantity: parsedQuantity/);
  assert.match(screen, /entriesByMealType\[meal\.value\]/);
  assert.match(screen, /waterPresets = \[250, 500, 750\]/);
  assert.match(screen, /addLocalWaterLog\(\{ userId, amountMl \}\)/);
});

test('nutrition service searches and creates public foods, logs local meals, computes totals, and syncs remote nutrition rows', () => {
  const service = readProjectFile('src/features/nutrition/nutrition-service.ts');

  assert.match(service, /export async function searchFoodsByName\(query: string\)/);
  assert.match(service, /\.from\('foods'\)\s*\.select\(FOOD_SELECT\)\s*\.ilike\('name', `%\$\{trimmed\}%`\)/s);
  assert.match(service, /export async function createFood/);
  assert.match(service, /\.from\('foods'\)\s*\.insert\(foodPayload\)\s*\.select\(FOOD_SELECT\)/s);
  assert.match(service, /export function addLocalMealItem/);
  assert.match(service, /insert into meal_logs_local \([\s\S]*meal_type,[\s\S]*values \(\?, \?, \?, \?, 'pending', \?\)/);
  assert.match(service, /insert into meal_items_local \([\s\S]*food_name,[\s\S]*calories,[\s\S]*protein_g,[\s\S]*carbs_g,[\s\S]*fat_g,[\s\S]*values \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, 'pending', \?\)/);
  assert.match(service, /export function addLocalWaterLog/);
  assert.match(service, /insert into water_logs_local \([\s\S]*amount_ml,[\s\S]*values \(\?, \?, \?, \?, 'pending', \?\)/);
  assert.match(service, /export function getDailyNutritionSummary/);
  assert.match(service, /from meal_logs_local[\s\S]*logged_at >= \?[\s\S]*logged_at < \?/);
  assert.match(service, /from meal_items_local[\s\S]*meal_log_local_id in \(\$\{placeholders\}\)/);
  assert.match(service, /from water_logs_local[\s\S]*logged_at >= \?[\s\S]*logged_at < \?/);
  assert.match(service, /export function syncPendingNutritionLogs\(\)/);
  assert.match(service, /from meal_logs_local[\s\S]*where sync_status in \('pending', 'failed'\)[\s\S]*and user_id != \?/);
  assert.match(service, /\.from\('meal_logs'\)[\s\S]*\.upsert\([\s\S]*\{ onConflict: 'id' \}/);
  assert.match(service, /\.from\('meal_items'\)[\s\S]*\.upsert\(itemRows, \{ onConflict: 'id' \}\)/);
  assert.match(service, /from water_logs_local[\s\S]*where sync_status in \('pending', 'failed'\)[\s\S]*and user_id != \?/);
  assert.match(service, /\.from\('water_logs'\)[\s\S]*\.upsert\([\s\S]*\{ onConflict: 'id' \}/);
});

test('local-db web adapter supports the nutrition query and mutation patterns used by the service', () => {
  const localDb = normalizeWhitespace(readProjectFile('src/lib/local-db.ts'));

  assert.match(localDb, /insert into meal_logs_local/);
  assert.match(localDb, /insert into meal_items_local/);
  assert.match(localDb, /insert into water_logs_local/);
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

test('root layout syncs the nutrition queue when the app starts and returns active', () => {
  const layout = readProjectFile('app/_layout.tsx');

  assert.match(layout, /import \{ syncPendingNutritionLogs \} from '@\/src\/features\/nutrition\/nutrition-service';/);
  assert.match(layout, /syncPendingNutritionLogs\(\)/);
  assert.match(layout, /Failed to sync pending nutrition logs/);
});

test('runtime flags keep nutrition local by default and enable Supabase explicitly', () => {
  const flags = readProjectFile('src/lib/runtime-flags.ts');

  assert.match(flags, /EXPO_PUBLIC_NUTRITION_SYNC_SOURCE === 'supabase'/);
  assert.match(flags, /USE_SUPABASE_FOODS =\s*USE_REMOTE_NUTRITION_SYNC \|\| process\.env\.EXPO_PUBLIC_FOOD_SOURCE === 'supabase'/);
});
