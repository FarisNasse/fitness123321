export const MASS_TO_GRAMS: Readonly<Record<string, number>>;
export const VOLUME_TO_ML: Readonly<Record<string, number>>;
export function normalizeNutritionUnit(unit: string | null | undefined): string;
export function calculateFoodMultiplier(
  food: {
    nutritionBasisSize?: number | null;
    nutritionBasisUnit?: string | null;
    servingSize?: number | null;
    servingUnit?: string | null;
    servingOptions?: Array<{ amount: number; unit: string; gramWeight?: number | null }> | null;
  },
  quantity: number,
  unit: string
): number;
