import assert from 'node:assert/strict';
import test from 'node:test';

import { fileExists, readProjectFile, readProjectJson } from './helpers/project.mjs';

const appScreens = [
  'app/index.tsx',
  'app/_layout.tsx',
  'app/(auth)/login.tsx',
  'app/(auth)/register.tsx',
  'app/(onboarding)/index.tsx',
  'app/(tabs)/dashboard.tsx',
  'app/(tabs)/nutrition.tsx',
  'app/(tabs)/progress.tsx',
  'app/(tabs)/wellness.tsx',
  'app/(tabs)/workouts.tsx',
  'app/workout/exercises.tsx',
  'app/workout/session/[id].tsx',
  'app/workout/history/[id].tsx',
];

test('package exposes fast test commands without adding heavy native test dependencies', () => {
  const pkg = readProjectJson('package.json');

  assert.equal(pkg.packageManager, 'npm@10.9.2');
  assert.equal(pkg.engines?.node, '>=20 <23');
  assert.equal(pkg.engines?.npm, '10.x');
  assert.equal(readProjectFile('.nvmrc').trim(), '20');
  assert.match(readProjectFile('.npmrc'), /engine-strict=true/);
  assert.equal(pkg.scripts.test, 'node --test');
  assert.equal(
    pkg.scripts['test:all'],
    'npm run test && npm run check:exercises && npm run check:local && npm run typecheck'
  );

  for (const dependency of ['jest', 'jest-expo', '@testing-library/react-native', 'react-test-renderer']) {
    assert.equal(pkg.devDependencies?.[dependency], undefined, `${dependency} should not be required`);
  }
});



test('Expo SDK package ranges are pinned to the committed lockfile versions', () => {
  const pkg = readProjectJson('package.json');
  const lock = readProjectJson('package-lock.json');

  assert.equal(pkg.dependencies.expo, '56.0.11');
  assert.equal(pkg.dependencies['expo-crypto'], '56.0.4');
  assert.equal(lock.packages[''].dependencies.expo, pkg.dependencies.expo);
  assert.equal(lock.packages[''].dependencies['expo-crypto'], pkg.dependencies['expo-crypto']);
  assert.doesNotMatch(pkg.dependencies.expo, /^[~^]/);
  assert.doesNotMatch(pkg.dependencies['expo-crypto'], /^[~^]/);
});

test('routing and source files required by the app exist', () => {
  for (const file of appScreens) {
    assert.equal(fileExists(file), true, `missing screen ${file}`);
  }

  for (const file of [
    'src/components/Button.tsx',
    'src/components/Card.tsx',
    'src/components/MetricCard.tsx',
    'src/components/Screen.tsx',
    'src/features/auth/auth-session-context.tsx',
    'src/features/auth/dev-auth.ts',
    'src/features/workouts/ExerciseLibrary.tsx',
    'src/features/workouts/exercise-service.ts',
    'src/features/workouts/workout-service.ts',
    'src/features/workouts/pr-service.ts',
    'src/lib/local-db.ts',
    'src/lib/runtime-flags.ts',
    'src/lib/supabase.ts',
    'src/types/models.ts',
  ]) {
    assert.equal(fileExists(file), true, `missing implementation file ${file}`);
  }
});

test('macro ring uses React-compatible SVG transform props on web', () => {
  const macroRing = readProjectFile('src/components/MacroRing.tsx');

  assert.doesNotMatch(macroRing, /transform-origin|origin=\{`\$\{center\}, \$\{center\}`\}/);
  assert.match(macroRing, /transform=\{`rotate\(-90 \$\{center\} \$\{center\}\)`\}/);
});


test('Tailwind and NativeWind use class-based dark mode on web', () => {
  const tailwind = readProjectFile('tailwind.config.js');

  assert.match(tailwind, /darkMode:\s*'class'/);
});

test('weight chart avoids gifted chart web runtime crashes by using SVG primitives', () => {
  const chart = readProjectFile('src/components/WeightChart.tsx');

  assert.doesNotMatch(chart, /react-native-gifted-charts/);
  assert.match(chart, /import Svg, \{ Circle, Path, Text as SvgText \} from 'react-native-svg';/);
  assert.match(chart, /function buildWeightChartGeometry\(\)/);
  assert.match(chart, /<Svg width="100%" height=\{chartHeight\}/);
  assert.match(chart, /<Path\s+d=\{linePath\}/s);
});

test('root layout initializes local persistence and syncs workout queue on app activation', () => {
  const layout = readProjectFile('app/_layout.tsx');

  assert.match(layout, /initializeLocalDb\(\);/);
  assert.match(layout, /syncPendingWorkoutSessions\(\)/);
  assert.match(layout, /AppState\.addEventListener\(\s*'change'/s);
  assert.match(layout, /if \(state === 'active'\)/);
  assert.match(layout, /<QueryClientProvider client=\{queryClient\}>/);
  assert.match(layout, /<Stack\.Screen\s*name="workout\/exercises"/);
  assert.match(layout, /<Stack\.Screen\s*name="workout\/session\/\[id\]"/);
  assert.match(layout, /<Stack\.Screen\s*name="workout\/history\/\[id\]"/);
});


test('auth session guard resolves Supabase session, profile onboarding state, and protected route redirects', () => {
  const layout = readProjectFile('app/_layout.tsx');
  const index = readProjectFile('app/index.tsx');
  const authLayout = readProjectFile('app/(auth)/_layout.tsx');
  const onboardingLayout = readProjectFile('app/(onboarding)/_layout.tsx');
  const tabsLayout = readProjectFile('app/(tabs)/_layout.tsx');
  const authContext = readProjectFile('src/features/auth/auth-session-context.tsx');

  assert.match(layout, /supabase\.auth\.getSession\(\)/);
  assert.match(layout, /supabase\.auth\.onAuthStateChange\(/);
  assert.match(layout, /\.from\('profiles'\)\s*\.select\('id, primary_goal'\)/s);
  assert.match(layout, /maybeSingle\(\)/);
  assert.match(layout, /nextProfile\?\.primary_goal \? 'onboarded' : 'needs-onboarding'/);
  assert.match(layout, /<AuthSessionContext\.Provider value=\{authContextValue\}>/);
  assert.match(layout, /refreshProfile/);

  assert.match(authContext, /export type AuthStatus = 'loading' \| 'signed-out' \| 'needs-onboarding' \| 'onboarded'/);
  assert.match(authContext, /export function useAuthSession\(\)/);
  assert.match(authContext, /export function routeForAuthStatus/);
  assert.match(authContext, /export function AuthLoadingState/);

  assert.match(index, /routeForAuthStatus\(status\)/);
  assert.match(index, /<AuthLoadingState \/>/);
  assert.match(index, /<Redirect href=\{route\} \/>/);
  assert.doesNotMatch(index, /href=\"\/dashboard\"/);

  assert.match(authLayout, /status === 'needs-onboarding'[\s\S]*<Redirect href=\"\/onboarding\" \/>/);
  assert.match(authLayout, /status === 'onboarded'[\s\S]*<Redirect href=\"\/dashboard\" \/>/);
  assert.match(onboardingLayout, /status === 'signed-out'[\s\S]*<Redirect href=\"\/login\" \/>/);
  assert.match(onboardingLayout, /status === 'onboarded'[\s\S]*<Redirect href=\"\/dashboard\" \/>/);
  assert.match(tabsLayout, /status === 'signed-out'[\s\S]*<Redirect href=\"\/login\" \/>/);
  assert.match(tabsLayout, /status === 'needs-onboarding'[\s\S]*<Redirect href=\"\/onboarding\" \/>/);
  assert.match(tabsLayout, /return \(\s*<Tabs/s);
});



test('local dev auth bypasses Supabase sign in while keeping Supabase auth available by flag', () => {
  const flags = readProjectFile('src/lib/runtime-flags.ts');
  const layout = readProjectFile('app/_layout.tsx');
  const devAuth = readProjectFile('src/features/auth/dev-auth.ts');
  const login = readProjectFile('app/(auth)/login.tsx');
  const register = readProjectFile('app/(auth)/register.tsx');
  const onboarding = readProjectFile('app/(onboarding)/index.tsx');
  const supabaseClient = readProjectFile('src/lib/supabase.ts');
  const envExample = readProjectFile('.env.example');

  assert.match(flags, /export const AUTH_MODE = process\.env\.EXPO_PUBLIC_AUTH_MODE \?\? 'local'/);
  assert.match(flags, /export const USE_DEV_AUTH = AUTH_MODE !== 'supabase'/);
  assert.match(flags, /LOCAL_DEV_USER_EMAIL = 'local-dev@example\.test'/);

  assert.match(devAuth, /export const LOCAL_DEV_PROFILE/);
  assert.match(devAuth, /primary_goal: 'Track performance'/);
  assert.match(devAuth, /export const LOCAL_DEV_SESSION/);
  assert.match(devAuth, /local-dev-access-token/);

  assert.match(layout, /if \(USE_DEV_AUTH\) \{\s*loadLocalDevSession\(\);\s*return;\s*\}/s);
  assert.match(layout, /setStatus\('onboarded'\)/);
  assert.match(layout, /supabase\.auth\.getSession\(\)/);
  assert.match(layout, /supabase\.auth\.onAuthStateChange\(/);

  assert.match(login, /if \(USE_DEV_AUTH\) \{\s*router\.replace\('\/dashboard'\);\s*return;\s*\}/s);
  assert.match(login, /Unable to reach Supabase/);
  assert.match(register, /if \(USE_DEV_AUTH\) \{\s*router\.replace\('\/dashboard'\);\s*return;\s*\}/s);
  assert.match(register, /Unable to reach Supabase/);
  assert.match(onboarding, /if \(USE_DEV_AUTH\) \{\s*await refreshProfile\(\);\s*setIsSubmitting\(false\);\s*router\.replace\('\/dashboard'\);\s*return;\s*\}/s);

  assert.match(supabaseClient, /Set EXPO_PUBLIC_AUTH_MODE=local/);
  assert.match(supabaseClient, /fallbackSupabaseUrl/);
  assert.match(envExample, /EXPO_PUBLIC_AUTH_MODE=local/);
  assert.match(envExample, /EXPO_PUBLIC_AUTH_MODE=supabase/);
});

test('auth screens validate input, trim email, call Supabase, and route correctly', () => {
  const login = readProjectFile('app/(auth)/login.tsx');
  const register = readProjectFile('app/(auth)/register.tsx');

  assert.match(login, /Alert\.alert\('Missing info', 'Enter your email and password\.'\)/);
  assert.match(login, /signInWithPassword\(\{\s*email: email\.trim\(\),\s*password,/s);
  assert.match(login, /Alert\.alert\('Unable to sign in', error\.message\)/);
  assert.match(login, /router\.replace\('\/'\)/);

  assert.match(register, /Alert\.alert\('Missing info', 'Enter your email and password\.'\)/);
  assert.match(register, /signUp\(\{\s*email: email\.trim\(\),\s*password,/s);
  assert.match(register, /display_name: displayName\.trim\(\)/);
  assert.match(register, /from\('profiles'\)\.upsert\(\{/);
  assert.match(register, /display_name: displayName\.trim\(\) \|\| null/);
  assert.match(register, /router\.replace\('\/onboarding'\)/);
});

test('onboarding persists goal and level for the authenticated profile', () => {
  const onboarding = readProjectFile('app/(onboarding)/index.tsx');

  for (const goal of ['Lose weight', 'Build muscle', 'Improve endurance', 'Get healthier', 'Track performance']) {
    assert.ok(onboarding.includes(goal), `missing onboarding goal ${goal}`);
  }

  for (const level of ['beginner', 'intermediate', 'advanced', 'athlete']) {
    assert.ok(onboarding.includes(`'${level}'`), `missing fitness level ${level}`);
  }

  assert.match(onboarding, /supabase\.auth\.getUser\(\)/);
  assert.match(onboarding, /useAuthSession\(\)/);
  assert.match(onboarding, /await refreshProfile\(\);/);
  assert.match(onboarding, /primary_goal: goal/);
  assert.match(onboarding, /fitness_level: level/);
  assert.match(onboarding, /router\.replace\('\/dashboard'\)/);
});

test('workouts tab is wired as a simplified workout hub', () => {
  const workouts = readProjectFile('app/(tabs)/workouts.tsx');

  assert.match(workouts, /getWorkoutOwnerUserId\(\)/);
  assert.match(workouts, /createLocalWorkoutSession\(userId, 'Quick workout'\)/);
  assert.match(workouts, /router\.push\(`\/workout\/session\/\$\{sessionId\}`\)/);
  assert.match(workouts, /getCompletedWorkoutSessions\(4\)/);
  assert.match(workouts, /Start a workout, log your sets, and review what you completed\./);
  assert.match(workouts, /Quick actions/);
  assert.doesNotMatch(workouts, /Quick start/);
  assert.match(workouts, /MiniStat label="Recent sessions"/);
  assert.match(workouts, /MiniStat label="Sets logged"/);
  assert.match(workouts, /title="Start workout"[\s\S]*title="Browse exercises"/);
  assert.match(workouts, /function browseExercises\(\) \{[\s\S]*router\.push\('\/workout\/exercises'\);[\s\S]*\}/);
  assert.match(workouts, /title="Browse exercises"[\s\S]*onPress=\{browseExercises\}[\s\S]*variant="outline"/);
  for (const phrase of [
    'Supabase setup',
    'Cloud sync on',
    'Local mode',
    'remote database',
    'local data persist',
    'starting the demo',
    'npm run check:exercises',
    'seed file',
  ]) {
    assert.doesNotMatch(workouts, new RegExp(phrase));
  }
  assert.doesNotMatch(workouts, /<MiniStat[^>]*label="Sync"/s);
  assert.doesNotMatch(workouts, /<ExerciseLibrary scrollMode="page" \/>/);
  assert.doesNotMatch(workouts, /import \{ ExerciseLibrary \}/);
  assert.match(workouts, /router\.push\(`\/workout\/history\/\$\{session\.local_id\}`\)/);
  assert.match(workouts, /syncStatusLabel=\{getWorkoutSyncStatusLabel\(syncUiStatus\)\}/);
  assert.match(workouts, /onRetrySync=\{/);
});

test('dedicated workout exercise browser reuses the shared ExerciseLibrary as a full page', () => {
  const exerciseRoute = readProjectFile('app/workout/exercises.tsx');
  const layout = readProjectFile('app/_layout.tsx');

  assert.match(exerciseRoute, /import \{ Screen \} from '@\/src\/components\/Screen';/);
  assert.match(exerciseRoute, /import \{ ExerciseLibrary \} from '@\/src\/features\/workouts\/ExerciseLibrary';/);
  assert.match(exerciseRoute, /<Screen scrollable=\{false\}>[\s\S]*<ExerciseLibrary scrollMode="page" \/>[\s\S]*<\/Screen>/);
  assert.match(layout, /name="workout\/exercises"[\s\S]*title: 'Exercise Browser'[\s\S]*headerStyle: \{ backgroundColor: '#0d1117' \}[\s\S]*headerTintColor: '#a3e635'/);
});


test('live workout screen no longer depends on a placeholder exercise id', () => {
  const route = readProjectFile('app/workout/session/[id].tsx');
  const controller = readProjectFile('src/features/workouts/live/useLiveWorkoutController.ts');
  const view = readProjectFile('src/features/workouts/live/components/LiveWorkoutScreenView.tsx');

  assert.doesNotMatch(route + controller + view, /placeholderExerciseId|placeholder-exercise/i);
  assert.doesNotMatch(controller, /exerciseId:\s*['"][^'"]+['"]/);
  assert.match(controller, /const \[selectedExercise, setSelectedExercise\] = useState<Exercise \| null>\(null\)/);
  assert.match(controller, /function addSet\(\) \{\s*if \(!selectedExercise \|\| !sessionId \|\| !session\) return;/s);
  assert.match(view, /onPress=\{controller\.addSet\}/);
  assert.match(controller, /addLocalWorkoutSet\(\{\s*sessionLocalId: sessionId,\s*exerciseId: selectedExercise\.id,/s);
});

test('live workout exercise picker sheet wires ExerciseLibrary selection into session state', () => {
  const controller = readProjectFile('src/features/workouts/live/useLiveWorkoutController.ts');
  const view = readProjectFile('src/features/workouts/live/components/LiveWorkoutScreenView.tsx');

  assert.match(view, /openExercisePicker/);
  assert.match(view, /<BaseSheet[\s\S]*visible=\{controller\.activeSheet === 'exercise-picker'\}/);
  assert.match(view, /<ExerciseLibrary\s+onSelect=\{controller\.chooseExercise\}[\s\S]*selectButtonTitle="Use this exercise"/);
  assert.match(controller, /async function chooseExercise\(exercise: Exercise\)[\s\S]*rememberExercises\(\[exercise\]\);[\s\S]*setExerciseLookup\(\(current\) => \(\{[\s\S]*\[exercise\.id\]: exercise,[\s\S]*\}\)\);/);
  assert.match(controller, /setExerciseSetMap\(\(current\) => \{\s*const nextMap = new Map\(current\);[\s\S]*if \(!nextMap\.has\(exercise\.id\)\) \{\s*nextMap\.set\(exercise\.id, \[\]\);\s*\}[\s\S]*return nextMap;\s*\}\);/);
  assert.match(controller, /rememberExerciseSelection\(exercise\);\s*setSelectedExercise\(exercise\);\s*dispatch\(\{ type: 'sheet\.closed' \}\);/);
});

test('live workout screen groups logged sets by exercise and renders compact exercise switcher plus recent set list', () => {
  const selectors = readProjectFile('src/features/workouts/live/liveWorkoutSelectors.ts');
  const controller = readProjectFile('src/features/workouts/live/useLiveWorkoutController.ts');
  const view = readProjectFile('src/features/workouts/live/components/LiveWorkoutScreenView.tsx');

  assert.match(selectors, /function buildExerciseSetMap\(sets: LocalWorkoutSetRow\[\]\)[\s\S]*map\.get\(set\.exercise_id\) \?\? \[\];[\s\S]*map\.set\(set\.exercise_id, \[\.\.\.exerciseSets, set\]\);[\s\S]*new Map<string, LocalWorkoutSetRow\[\]>\(\)/);
  assert.match(controller, /const nextSets = getLocalWorkoutSets\(sessionId\);\s*const nextMap = buildExerciseSetMap\(nextSets\);\s*setSets\(nextSets\);\s*setExerciseSetMap\(nextMap\);/);
  assert.match(controller, /Array\.from\(nextMap\.keys\(\)\)\s*\.map\(\(exerciseId\) => resolveExercise\(exerciseId\)\)/);
  assert.match(view, /<RecentSetList[\s\S]*sets=\{controller\.recentSets\}/);
  assert.match(view, /controller\.selectedExercises\.map\(\(exercise\) => \{/);
  assert.match(view, /onPress=\{\(\) => void controller\.selectExerciseForLogging\(exercise\)\}/);
});

test('live workout module supports exercise picking, validation, set logging, rest, and finish flow', () => {
  const controller = readProjectFile('src/features/workouts/live/useLiveWorkoutController.ts');
  const view = readProjectFile('src/features/workouts/live/components/LiveWorkoutScreenView.tsx');

  assert.match(view, /<ExerciseLibrary\s+onSelect=\{controller\.chooseExercise\}/s);
  assert.match(controller, /useState<Exercise\[\]>\(\[\]\)/);
  assert.match(controller, /Map<string, LocalWorkoutSetRow\[\]>/);
  assert.match(view, /\+ Exercise/);
  assert.match(view, /controller\.selectedExercises\.map\(\(exercise\) =>/);
  assert.match(controller, /exerciseSetMap\.get\(selectedExercise\.id\)/);
  assert.match(controller, /rememberExercises\(\[exercise\]\)/);
  assert.match(controller, /Alert\.alert\('Set not ready'/);
  assert.match(controller, /Alert\.alert\('Invalid reps', 'Enter a valid rep count\.'\)/);
  assert.match(controller, /Alert\.alert\('Invalid weight', 'Enter a valid weight\.'\)/);
  assert.match(controller, /function addSet\(\)/);
  assert.match(controller, /addLocalWorkoutSet\(\{\s*sessionLocalId: sessionId,\s*exerciseId: selectedExercise\.id,/s);
  assert.match(controller, /const setNumber = currentExerciseSets\.length \+ 1/);
  assert.match(view, /LAST SET[\s\S]*Set \{draft\.setNumber\}[\s\S]*Recent sets/);
  assert.match(view, /onPress=\{\(\) => void controller\.selectExerciseForLogging\(exercise\)\}/);
  assert.match(controller, /completeLocalWorkoutSession\(sessionId\)/);
  assert.match(controller, /syncPendingWorkoutSessions\(\)/);
  assert.match(controller, /router\.replace\('\/workouts'\)/);
});

test('workout history screen reads local session and groups sets by exercise', () => {
  const history = readProjectFile('app/workout/history/[id].tsx');

  assert.match(history, /getLocalWorkoutSession\(sessionId\)/);
  assert.match(history, /getLocalWorkoutSets\(sessionId\)/);
  assert.match(history, /getSeededExercises\(\)/);
  assert.match(history, /getExerciseById\(set\.exercise_id\)/);
  assert.match(history, /Unknown exercise/);
  assert.match(history, /Workout not found/);
  assert.match(history, /No sets logged/);
});

test('exercise library supports loading, searching, filtering, clearing, details, and optional selection callback', () => {
  const library = readProjectFile('src/features/workouts/ExerciseLibrary.tsx');

  for (const key of ['muscleGroup', 'equipment', 'movementType', 'difficulty']) {
    assert.ok(library.includes(`key: '${key}'`), `missing ${key} filter`);
  }

  assert.match(library, /queryKey: \['exercises'\]/);
  assert.match(library, /queryFn: fetchExercises/);
  assert.match(library, /scrollMode\?: 'page' \| 'contained'/);
  assert.match(library, /scrollMode = 'contained'/);
  assert.match(library, /FlatList/);
  assert.match(library, /<FlatList<Exercise>/);
  assert.match(library, /data=\{listData\}/);
  assert.match(library, /renderItem=\{renderExerciseCard\}/);
  assert.match(library, /keyExtractor=\{keyExtractor\}/);
  assert.match(library, /ListHeaderComponent=\{listHeader\}/);
  assert.match(library, /ListEmptyComponent=\{renderEmptyState\}/);
  assert.match(library, /initialNumToRender=\{16\}/);
  assert.match(library, /windowSize=\{8\}/);
  assert.match(library, /keyboardShouldPersistTaps="handled"/);
  assert.match(library, /className="max-h-full"/);
  assert.match(library, /return \([\s\S]*<View className="flex-1" style=\{styles\.pageLibrary\}>[\s\S]*\{libraryList\}[\s\S]*\{libraryModals\}/);
  assert.doesNotMatch(library, /filteredExercises\.map\(\(exercise\)/);
  assert.match(library, /searchQuery\.trim\(\)\.toLowerCase\(\)/);
  assert.match(library, /exercise\.name,[\s\S]*exercise\.muscleGroup,[\s\S]*exercise\.equipment,[\s\S]*exercise\.movementType,[\s\S]*exercise\.difficulty,/);
  assert.match(library, /function clearFilters\(\)/);
  assert.match(library, /setSearchQuery\(''\)/);
  assert.match(library, /const \[isFilterSheetOpen, setIsFilterSheetOpen\] = useState\(false\)/);
  assert.match(library, /const activeFilterCount = FILTERS\.filter\(\(filter\) => filters\[filter\.key\]\)\.length/);
  assert.match(library, /<Modal[\s\S]*visible=\{isFilterSheetOpen\}/);
  assert.match(library, /onSelect\?\.\(exercise\)/);
  assert.match(library, /<Modal[\s\S]*visible=\{Boolean\(selectedExercise\)\}/);

  assert.match(library, /Muscle diagram placeholder/);
});

test('tailwind theme tokens keep dark readable fallbacks when CSS variables are missing', () => {
  const tailwindConfig = readProjectFile('tailwind.config.js');

  assert.match(tailwindConfig, /const withOpacity = \(variableName, fallback\) =>/);
  assert.match(tailwindConfig, /rgb\(var\(\$\{variableName\}, \$\{fallback\}\)\)/);
  assert.match(tailwindConfig, /'base-content': withOpacity\('--color-base-content', '230 237 243'\)/);
  assert.match(tailwindConfig, /'base-muted': withOpacity\('--color-base-muted', '139 148 158'\)/);
  assert.match(tailwindConfig, /'base-100': withOpacity\('--color-base-100', '13 17 23'\)/);
});

test('exercise library and live picker use theme-aware tokens instead of pasted-in light cards', () => {
  const library = readProjectFile('src/features/workouts/ExerciseLibrary.tsx');
  const view = readProjectFile('src/features/workouts/live/components/LiveWorkoutScreenView.tsx');

  assert.match(library, /border-primary\/40 bg-primary\/15/);
  assert.match(library, /border-base-300 bg-base-100 active:bg-base-300/);
  assert.match(library, /rounded-card border border-base-300 bg-base-100 p-4 active:border-primary\/40 active:bg-base-300/);
  assert.match(library, /rounded-input border border-base-300 bg-base-100 px-4 py-3 text-base font-body text-base-content/);
  assert.match(library, /placeholderTextColor=\{colors\.baseMuted\}/);
  assert.match(library, /rounded-t-card border border-base-300 bg-base-200/);
  for (const phrase of ['npm run check:exercises', 'seed file', 'Supabase', 'remote database', 'Local mode', 'Cloud sync on', 'seeded']) {
    assert.doesNotMatch(library, new RegExp(phrase, 'i'));
  }
  assert.match(library, /StyleSheet\.create\(\{[\s\S]*exerciseCard:\s*\{[\s\S]*backgroundColor: colors\.base100,[\s\S]*color: colors\.baseContent,[\s\S]*modalSheet:\s*\{[\s\S]*backgroundColor: colors\.base200,/);
  assert.match(library, /style=\{styles\.searchInput\}/);
  assert.doesNotMatch(library, /#(?:ffffff|f8fafc|f1f5f9|e2e8f0|cbd5e1|64748b|475569|334155|0f172a|0369a1|bae6fd|e0f2fe|94a3b8)/i);

  assert.match(view, /backgroundColor: colors\.base200/);
  assert.match(view, /borderColor: colors\.base300/);
  assert.match(view, /overflow: 'hidden'/);
  assert.doesNotMatch(view, /backgroundColor:\s*'#ffffff'/);
});

test('live workout screen uses readable dark-theme colors for the main session surfaces', () => {
  const route = readProjectFile('app/workout/session/[id].tsx');
  const view = readProjectFile('src/features/workouts/live/components/LiveWorkoutScreenView.tsx');

  assert.match(route, /import \{ colors \} from '@\/src\/lib\/theme';/);
  assert.match(view, /backgroundColor: colors\.base100/);
  assert.match(view, /borderColor: colors\.base300/);
  assert.match(view, /color: colors\.baseContent/);
  assert.match(view, /placeholderTextColor=\{colors\.baseMuted\}/);
  assert.match(view, /backgroundColor: selected \? colors\.primary : colors\.base100/);
  assert.match(view, /backgroundColor: colors\.base200,[\s\S]*borderColor: colors\.base300,[\s\S]*Edit set \{controller\.editingSet\?\.set_number\}/);
  assert.doesNotMatch(view, /#(?:ffffff|f8fafc|f1f5f9|e2e8f0|cbd5e1|64748b|475569|334155|0f172a|94a3b8)/i);
});
