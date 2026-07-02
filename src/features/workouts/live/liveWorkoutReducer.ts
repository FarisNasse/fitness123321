import {
  INITIAL_LIVE_WORKOUT_UI_STATE,
  type LiveWorkoutSheet,
  type LiveWorkoutUiState,
  type SetDraft,
} from './liveWorkoutState';

export type LiveWorkoutEvent =
  | { type: 'draft.initialized'; exerciseId: string; draft: SetDraft; replaceDraft?: boolean }
  | { type: 'draft.changed'; exerciseId: string; patch: Partial<Pick<SetDraft, 'reps' | 'weight'>> }
  | { type: 'draft.replaced'; exerciseId: string; draft: SetDraft }
  | { type: 'set.logged'; exerciseId: string; nextDraft: SetDraft; notice: string }
  | { type: 'rest.started'; seconds: number }
  | { type: 'rest.ticked' }
  | { type: 'rest.skipped' }
  | { type: 'sheet.opened'; sheet: NonNullable<LiveWorkoutSheet> }
  | { type: 'sheet.closed' }
  | { type: 'notice.shown'; notice: string }
  | { type: 'notice.cleared' };

export function liveWorkoutReducer(
  state: LiveWorkoutUiState = INITIAL_LIVE_WORKOUT_UI_STATE,
  event: LiveWorkoutEvent
): LiveWorkoutUiState {
  switch (event.type) {
    case 'draft.initialized': {
      const currentDraft = state.draftsByExerciseId[event.exerciseId];

      if (currentDraft?.dirty && !event.replaceDraft) {
        return state;
      }

      if (currentDraft && !event.replaceDraft) {
        return state;
      }

      return {
        ...state,
        draftsByExerciseId: {
          ...state.draftsByExerciseId,
          [event.exerciseId]: event.draft,
        },
      };
    }

    case 'draft.changed': {
      const currentDraft = state.draftsByExerciseId[event.exerciseId] ?? {
        reps: '8',
        weight: '0',
        source: 'suggested' as const,
        dirty: false,
      };

      return {
        ...state,
        draftsByExerciseId: {
          ...state.draftsByExerciseId,
          [event.exerciseId]: {
            ...currentDraft,
            ...event.patch,
            source: 'manual',
            dirty: true,
          },
        },
      };
    }

    case 'draft.replaced':
      return {
        ...state,
        draftsByExerciseId: {
          ...state.draftsByExerciseId,
          [event.exerciseId]: event.draft,
        },
      };

    case 'set.logged':
      return {
        ...state,
        draftsByExerciseId: {
          ...state.draftsByExerciseId,
          [event.exerciseId]: event.nextDraft,
        },
        savedNotice: event.notice,
      };

    case 'rest.started':
      return { ...state, restSeconds: event.seconds };

    case 'rest.ticked': {
      if (state.restSeconds === null) return state;
      const nextSeconds = state.restSeconds - 1;
      return { ...state, restSeconds: nextSeconds > 0 ? nextSeconds : null };
    }

    case 'rest.skipped':
      return { ...state, restSeconds: null };

    case 'sheet.opened':
      return { ...state, activeSheet: event.sheet };

    case 'sheet.closed':
      return { ...state, activeSheet: null };

    case 'notice.shown':
      return { ...state, savedNotice: event.notice };

    case 'notice.cleared':
      return { ...state, savedNotice: null };

    default:
      return state;
  }
}
