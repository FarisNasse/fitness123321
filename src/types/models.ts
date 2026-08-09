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
  externalId?: string;
  bodyPart?: string;
  targetMuscle?: string;
  secondaryMuscles?: string[];
  instructionSteps?: string[];
  mediaId?: string;
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
  isDeleted?: boolean;
  deletedAt?: string;
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
  isDeleted?: boolean;
  deletedAt?: string;
  syncStatus: SyncStatus;
};

export type ExerciseTargetLocal = {
  localId: string;
  exerciseId: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  incrementSize: number;
  deloadPercentage: number;
  syncStatus: SyncStatus;
  updatedAt: string;
};

export type FoodSource =
  | 'legacy'
  | 'usda_foundation'
  | 'usda_fndds'
  | 'usda_branded'
  | 'usda_sr_legacy'
  | 'usda_experimental'
  | 'usda_other'
  | 'restaurant'
  | 'custom';

export type FoodServingOption = {
  label: string;
  amount: number;
  unit: string;
  gramWeight?: number;
};

export type Food = {
  id: string;
  source: FoodSource;
  sourceId?: string;
  fdcId?: number;
  name: string;
  brand?: string;
  barcode?: string;
  category?: string;
  servingSize?: number;
  servingUnit?: string;
  householdServingText?: string;
  nutritionBasisSize?: number;
  nutritionBasisUnit?: string;
  servingOptions?: FoodServingOption[];
  detailsComplete?: boolean;
  publicationDate?: string;
  availableDate?: string;
  modifiedDate?: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG?: number;
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  imageUrl?: string;
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
