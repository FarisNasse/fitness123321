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
  calories: number | null;
  protein_g: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  sodium_mg: number | null;
};

export function normalizeFdcBarcode(value: unknown): string | null;
export function normalizeFdcSourceType(value: unknown): string;
export function normalizeFdcSearchFood(food: unknown): FdcCatalogFood | null;
export function searchFoodDataCentral(input: {
  query: string;
  apiKey: string;
  pageSize?: number;
  pageNumber?: number;
  fetchImpl?: typeof fetch;
}): Promise<FdcCatalogFood[]>;
export function searchFoodDataCentralByBarcode(input: {
  barcode: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<FdcCatalogFood[]>;
