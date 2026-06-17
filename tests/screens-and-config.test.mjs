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
  'app/workout/session/[id].tsx',
  'app/workout/history/[id].tsx',
];

test('package exposes fast test commands without adding heavy native test dependencies', () => {
  const pkg = readProjectJson('package.json');

  assert.equal(pkg.scripts.test, 'node --test tests/*.test.mjs');
  assert.equal(
    pkg.scripts['test:all'],
    'npm run test && npm run check:exercises && npm run check:local && npm run typecheck'
  );

  for (const dependency of ['jest', 'jest-expo', '@testing-library/react-native', 'react-test-renderer']) {
    assert.equal(pkg.devDependencies?.[dependency], undefined, `${dependency} should not be required`);
  }
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

test('root layout initializes local persistence and syncs workout queue on app activation', () => {
  const layout = readProjectFile('app/_layout.tsx');

  assert.match(layout, /initializeLocalDb\(\);/);
  assert.match(layout, /syncPendingWorkoutSessions\(\)/);
  assert.match(layout, /AppState\.addEventListener\(\s*'change'/s);
  assert.match(layout, /if \(state === 'active'\)/);
  assert.match(layout, /<QueryClientProvider client=\{queryClient\}>/);
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

test('workouts tab is wired to the local-first workout flow', () => {
  const workouts = readProjectFile('app/(tabs)/workouts.tsx');

  assert.match(workouts, /getWorkoutOwnerUserId\(\)/);
  assert.match(workouts, /createLocalWorkoutSession\(userId, 'Quick workout'\)/);
  assert.match(workouts, /router\.push\(`\/workout\/session\/\$\{sessionId\}`\)/);
  assert.match(workouts, /getCompletedWorkoutSessions\(4\)/);
  assert.match(workouts, /<ExerciseLibrary scrollMode="page" \/>/);
  assert.match(workouts, /router\.push\(`\/workout\/history\/\$\{session\.local_id\}`\)/);
  assert.match(workouts, /USE_REMOTE_WORKOUT_SYNC \? 'Cloud sync on' : 'Local mode'/);
});


test('live workout screen no longer depends on a placeholder exercise id', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.doesNotMatch(live, /placeholderExerciseId|placeholder-exercise/i);
  assert.doesNotMatch(live, /exerciseId:\s*['"`][^'"`]+['"`]/);
  assert.match(live, /const \[selectedExercise, setSelectedExercise\] = useState<Exercise \| null>\(null\)/);
  assert.match(live, /function addSet\(\) \{\s*if \(!sessionId \|\| !selectedExercise\) return;/s);
  assert.match(live, /<Button title="Add set" onPress=\{addSet\} disabled=\{!selectedExercise\} \/>/);
  assert.match(live, /addLocalWorkoutSet\(\{\s*sessionLocalId: sessionId,\s*exerciseId: selectedExercise\.id,/s);
});

test('live workout exercise picker modal wires ExerciseLibrary selection into session state', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /const \[isPickerOpen, setIsPickerOpen\] = useState\(false\)/);
  assert.match(live, /<Button title="Add exercise" onPress=\{\(\) => setIsPickerOpen\(true\)\} \/>/);
  assert.match(live, /<Modal[\s\S]*visible=\{isPickerOpen\}[\s\S]*<ExerciseLibrary\s+onSelect=\{chooseExercise\}[\s\S]*selectButtonTitle="Use this exercise"/);
  assert.match(live, /function chooseExercise\(exercise: Exercise\) \{[\s\S]*rememberExercises\(\[exercise\]\);[\s\S]*setExerciseLookup\(\(current\) => \(\{[\s\S]*\[exercise\.id\]: exercise,[\s\S]*\}\)\);/);
  assert.match(live, /setExerciseSetMap\(\(current\) => \{\s*const nextMap = new Map\(current\);[\s\S]*if \(!nextMap\.has\(exercise\.id\)\) \{\s*nextMap\.set\(exercise\.id, \[\]\);\s*\}[\s\S]*return nextMap;\s*\}\);/);
  assert.match(live, /rememberExerciseSelection\(exercise\);\s*setSelectedExercise\(exercise\);\s*setIsPickerOpen\(false\);/);
});

test('live workout screen groups logged sets by exercise and renders exercise cards', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /function buildExerciseSetMap\(sets: LocalWorkoutSetRow\[\]\) \{[\s\S]*map\.get\(set\.exercise_id\) \?\? \[\];[\s\S]*map\.set\(set\.exercise_id, \[\.\.\.exerciseSets, set\]\);[\s\S]*new Map<string, LocalWorkoutSetRow\[\]>\(\)/);
  assert.match(live, /const nextSets = getLocalWorkoutSets\(sessionId\);\s*const nextMap = buildExerciseSetMap\(nextSets\);\s*setSets\(nextSets\);\s*setExerciseSetMap\(nextMap\);/);
  assert.match(live, /Array\.from\(nextMap\.keys\(\)\)\s*\.map\(\(exerciseId\) => resolveExercise\(exerciseId\)\)/);
  assert.match(live, /selectedExercises\.map\(\(exercise\) => \{\s*const exerciseSets = exerciseSetMap\.get\(exercise\.id\) \?\? \[\];\s*const isActiveExercise = selectedExercise\?\.id === exercise\.id;/);
  assert.match(live, /<Card key=\{exercise\.id\}>[\s\S]*\{exercise\.name\}[\s\S]*\{exerciseSets\.length === 0 \? \([\s\S]*No sets logged for this exercise yet\.[\s\S]*\) : \([\s\S]*exerciseSets\.map\(\(set\) =>/);
  assert.match(live, /<Pressable onPress=\{\(\) => setSelectedExercise\(exercise\)\}>[\s\S]*\{isActiveExercise \? 'Selected' : 'Log set'\}/);
});

test('live workout screen supports exercise picking, validation, set logging, PR estimate, and finish flow', () => {
  const live = readProjectFile('app/workout/session/[id].tsx');

  assert.match(live, /<ExerciseLibrary\s+onSelect=\{chooseExercise\}/s);
  assert.match(live, /useState<Exercise\[\]>\(\[\]\)/);
  assert.match(live, /Map<string, LocalWorkoutSetRow\[\]>/);
  assert.match(live, /Button title="Add exercise"/);
  assert.match(live, /selectedExercises\.map\(\(exercise\) =>/);
  assert.match(live, /exerciseSetMap\.get\(exercise\.id\)/);
  assert.match(live, /rememberExercises\(\[exercise\]\)/);
  assert.match(live, /Alert\.alert\('Invalid reps', 'Enter a valid rep count\.'\)/);
  assert.match(live, /Alert\.alert\('Invalid weight', 'Enter a valid weight\.'\)/);
  assert.match(live, /addLocalWorkoutSet\(\{\s*sessionLocalId: sessionId,\s*exerciseId: selectedExercise\.id,/s);
  assert.match(live, /setNumber: selectedExerciseSets\.length \+ 1/);
  assert.match(live, /estimatedOneRepMax\(Number\(set\.weight\), Number\(set\.reps\)\)/);
  assert.match(live, /completeLocalWorkoutSession\(sessionId\)/);
  assert.match(live, /syncPendingWorkoutSessions\(\)/);
  assert.match(live, /router\.replace\('\/workouts'\)/);
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
  assert.match(library, /keyboardShouldPersistTaps="handled"/);
  assert.match(library, /style=\{\{ maxHeight: '100%' \}\}/);
  assert.match(library, /return <View style=\{\{ gap: 16 \}\}>\{libraryContent\}<\/View>/);
  assert.match(library, /searchQuery\.trim\(\)\.toLowerCase\(\)/);
  assert.match(library, /exercise\.name,[\s\S]*exercise\.muscleGroup,[\s\S]*exercise\.equipment,[\s\S]*exercise\.movementType,[\s\S]*exercise\.difficulty,/);
  assert.match(library, /function clearFilters\(\)/);
  assert.match(library, /setSearchQuery\(''\)/);
  assert.match(library, /onSelect\?\.\(exercise\)/);
  assert.match(library, /<Modal[\s\S]*visible=\{Boolean\(selectedExercise\)\}/);
  assert.match(library, /Muscle diagram placeholder/);
});
