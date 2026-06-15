export type SyncStatus = 'pending' | 'synced' | 'failed' | 'deleted';

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'athlete';

export type Profile = {
  id: string;
  displayName?: string;
  birthDate?: string;
  sex?: string;
  heightCm?: number;
  fitnessLevel?: FitnessLevel;
  primaryGoal?: string;
  dietaryPreference?: string;
};

export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment?: string;
  movementType?: string;
  difficulty?: string;
  instructions?: string;
  videoUrl?: string;
};

export type WorkoutSession = {
  localId: string;
  serverId?: string;
  userId: string;
  name: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  notes?: string;
  syncStatus: SyncStatus;
};

export type WorkoutSet = {
  localId: string;
  serverId?: string;
  sessionLocalId: string;
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weight?: number;
  completed: boolean;
  syncStatus: SyncStatus;
};

export type Food = {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  servingSize?: number;
  servingUnit?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealLog = {
  localId: string;
  serverId?: string;
  userId: string;
  loggedAt: string;
  mealType: MealType;
  syncStatus: SyncStatus;
};

export type BodyMeasurement = {
  id: string;
  userId: string;
  measuredAt: string;
  weightKg?: number;
  bodyFatPercent?: number;
  waistCm?: number;
  hipsCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  notes?: string;
};
