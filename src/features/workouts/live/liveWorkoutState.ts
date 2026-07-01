import type {
  getLocalWorkoutSession,
  getLocalWorkoutSets,
} from '@/src/features/workouts/workout-service';
import type { LocalWorkoutSet } from '@/src/lib/local-db';
import type { Exercise } from '@/src/types/models';

export const REST_DURATION_SECONDS = 90;
export const REP_STEP = 1;
export const WEIGHT_STEP = 5;
export const FALLBACK_WEIGHT_INCREMENT = WEIGHT_STEP;

export type LocalWorkoutSetRow = ReturnType<typeof getLocalWorkoutSets>[number];
export type WorkoutSessionForScreen = NonNullable<ReturnType<typeof getLocalWorkoutSession>>;

export type SessionLoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string; detail?: string };

export type SetDraftSource = 'suggested' | 'last-set' | 'manual';

export type SetDraft = {
  reps: string;
  weight: string;
  source: SetDraftSource;
  dirty: boolean;
};

export type DraftsByExerciseId = Record<string, SetDraft>;

export type LiveWorkoutSheet =
  | null
  | 'exercise-picker'
  | 'targets'
  | 'instructions'
  | 'finish'
  | 'edit-set';

export type LiveWorkoutUiState = {
  activeSheet: LiveWorkoutSheet;
  draftsByExerciseId: DraftsByExerciseId;
  restSeconds: number | null;
  savedNotice: string | null;
};

export type LiveWorkoutController = {
  session: WorkoutSessionForScreen;
  exercises: Exercise[];
  selectedExercises: Exercise[];
  selectedExercise: Exercise | null;
  selectedExerciseSets: LocalWorkoutSetRow[];
  sets: LocalWorkoutSetRow[];
  elapsedSeconds: number;
  restSeconds: number | null;
  savedNotice: string | null;
  activeSheet: LiveWorkoutSheet;
  currentSetDraft: CurrentSetDraft;
  lastSet: LocalWorkoutSetRow | null;
  recentSets: LocalWorkoutSetRow[];
  targetInputs: TargetInputs;
  effortFeedback: ProgressionEffortFeedback | null;
  editingSet: LocalWorkoutSet | null;
  editInputs: EditSetInputs;
  hasDirtyActiveDraft: boolean;
  exerciseProgressLabel: (exercise: Exercise) => string;
  chooseExercise: (exercise: Exercise) => Promise<void>;
  selectExerciseForLogging: (exercise: Exercise) => Promise<void>;
  openExercisePicker: () => void;
  openTargetSheet: () => void;
  openInstructionsSheet: () => void;
  openFinishSheet: () => void;
  closeSheet: () => void;
  updateSelectedDraft: (patch: Partial<Pick<SetDraft, 'reps' | 'weight'>>) => void;
  adjustReps: (delta: number) => void;
  adjustWeight: (delta: number) => void;
  addSet: () => void;
  skipRest: () => void;
  updateTargetInput: (key: keyof TargetInputs, value: string) => void;
  saveSelectedExerciseTarget: () => Promise<void>;
  setEffortFeedback: (feedback: ProgressionEffortFeedback | null) => void;
  openEditSheet: (set: LocalWorkoutSet) => void;
  updateEditInput: (key: keyof EditSetInputs, value: string) => void;
  saveEditedSet: () => void;
  deleteEditingSet: () => void;
  completeWorkout: () => void;
};

export type TargetInputs = {
  targetSets: string;
  repMin: string;
  repMax: string;
  incrementSize: string;
  deloadPercentage: string;
};

export type EditSetInputs = {
  reps: string;
  weight: string;
};

export type CurrentSetDraft = {
  exerciseName: string;
  setNumber: number;
  reps: string;
  weight: string;
  repRange: string;
  sourceLabel: string;
  targetSummary: string;
  logButtonTitle: string;
  logButtonDetail: string;
  incrementSize: number;
  validationMessage: string | null;
};

export type ProgressionEffortFeedback = 'easy' | 'good' | 'max';

export const DEFAULT_SET_DRAFT: SetDraft = {
  reps: '8',
  weight: '0',
  source: 'suggested',
  dirty: false,
};

export const DEFAULT_TARGET_INPUTS: TargetInputs = {
  targetSets: '3',
  repMin: '8',
  repMax: '12',
  incrementSize: '5',
  deloadPercentage: '10',
};

export const DEFAULT_EDIT_INPUTS: EditSetInputs = {
  reps: '',
  weight: '',
};

export const INITIAL_LIVE_WORKOUT_UI_STATE: LiveWorkoutUiState = {
  activeSheet: null,
  draftsByExerciseId: {},
  restSeconds: null,
  savedNotice: null,
};
