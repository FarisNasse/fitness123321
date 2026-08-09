export const MASS_TO_GRAMS = Object.freeze({
  g: 1,
  kg: 1000,
  mg: 0.001,
  oz: 28.349523125,
  lb: 453.59237,
});

export const VOLUME_TO_ML = Object.freeze({
  ml: 1,
  l: 1000,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  cup: 236.5882365,
});

export function normalizeNutritionUnit(unit) {
  const normalized = String(unit ?? '').trim().toLowerCase();
  const aliases = {
    gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg',
    milligram: 'mg', milligrams: 'mg', ounce: 'oz', ounces: 'oz',
    pound: 'lb', pounds: 'lb', lbs: 'lb', milliliter: 'ml', milliliters: 'ml',
    millilitre: 'ml', millilitres: 'ml', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
    teaspoon: 'tsp', teaspoons: 'tsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
    cups: 'cup', servings: 'serving', portion: 'serving', portions: 'serving',
  };
  return aliases[normalized] ?? normalized;
}

export function calculateFoodMultiplier(food, quantity, unit) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Food quantity must be greater than zero.');
  }

  const basisSize = Number(food?.nutritionBasisSize) > 0
    ? Number(food.nutritionBasisSize)
    : Number(food?.servingSize) > 0
      ? Number(food.servingSize)
      : 1;
  const basisUnit = normalizeNutritionUnit(food?.nutritionBasisUnit ?? food?.servingUnit ?? 'serving');
  const loggedUnit = normalizeNutritionUnit(unit || food?.servingUnit || basisUnit);

  if (loggedUnit === basisUnit) return quantity / basisSize;

  if (MASS_TO_GRAMS[basisUnit] && MASS_TO_GRAMS[loggedUnit]) {
    return (quantity * MASS_TO_GRAMS[loggedUnit]) / (basisSize * MASS_TO_GRAMS[basisUnit]);
  }

  if (VOLUME_TO_ML[basisUnit] && VOLUME_TO_ML[loggedUnit]) {
    return (quantity * VOLUME_TO_ML[loggedUnit]) / (basisSize * VOLUME_TO_ML[basisUnit]);
  }

  const servingOption = food?.servingOptions?.find((option) =>
    normalizeNutritionUnit(option?.unit) === loggedUnit && Number(option?.gramWeight) > 0
  );
  if (servingOption && MASS_TO_GRAMS[basisUnit]) {
    const optionAmount = Number(servingOption.amount) > 0 ? Number(servingOption.amount) : 1;
    const loggedGrams = (quantity / optionAmount) * Number(servingOption.gramWeight);
    return loggedGrams / (basisSize * MASS_TO_GRAMS[basisUnit]);
  }

  throw new Error(
    `Cannot convert ${unit || 'that unit'} to the nutrition basis ${basisSize} ${food?.nutritionBasisUnit ?? food?.servingUnit ?? 'serving'}.`
  );
}
