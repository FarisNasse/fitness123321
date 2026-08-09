export type FdcServingOption = {
  label: string;
  amount: number;
  unit: string;
  gram_weight: number;
};

export type FdcCatalogFood = {
  id: string;
  source_type: string;
  fdc_id: number;
  description: string;
  brand_name: string | null;
  gtin_upc: string | null;
  food_category: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  household_serving_text: string | null;
  nutrition_basis_size: number;
  nutrition_basis_unit: string;
  serving_options: FdcServingOption[];
  publication_date: string | null;
  available_date: string | null;
  modified_date: string | null;
  details_complete: boolean;
  calories: number | null;
  protein_g: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  sodium_mg: number | null;
};

export function extractFdcBarcode(value: unknown): string | null;
export function normalizeFdcBarcode(
  value: unknown,
  options?: { requireValidCheckDigit?: boolean }
): string | null;
export function canonicalizeFdcGtin(
  value: unknown,
  options?: { requireValidCheckDigit?: boolean }
): string | null;
export function isValidFdcGtin(value: unknown): boolean;
export function getFdcGtinAliases(value: unknown, options?: { requireValidCheckDigit?: boolean }): string[];
export function normalizeFdcSourceType(value: unknown): string;
export function normalizeFdcSearchFood(food: unknown): FdcCatalogFood | null;
export function normalizeFdcFoodDetails(food: unknown): FdcCatalogFood | null;
export function searchFoodDataCentral(input: {
  query: string;
  apiKey: string;
  pageSize?: number;
  pageNumber?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<FdcCatalogFood[]>;
export function getFoodDataCentralDetails(input: {
  fdcId: number;
  apiKey: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<FdcCatalogFood>;
export function searchFoodDataCentralByBarcode(input: {
  barcode: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<FdcCatalogFood[]>;
