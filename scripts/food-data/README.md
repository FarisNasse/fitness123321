# USDA FoodData Central ingestion

This directory is backend/operator tooling. Raw USDA datasets and the USDA API key must never be bundled with the Expo application.

## Flow

1. Download an official FoodData Central bulk JSON release outside the mobile bundle.
2. Normalize one source at a time to deterministic NDJSON.
3. Validate the normalized file.
4. Import with the Supabase service-role key. Rows are written to `food_catalog_staging` first.
5. `promote_food_catalog_import` validates and atomically upserts the public catalog, records import metrics, and clears staging.

Example:

```bash
node scripts/food-data/download-usda-data.mjs --url "<official bulk JSON URL>" --output .data/foundation.json
node scripts/food-data/normalize-usda-data.mjs --input .data/foundation.json --output .data/foundation.ndjson --source usda_foundation
node scripts/food-data/validate-food-catalog.mjs --input .data/foundation.ndjson --source usda_foundation
SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/food-data/import-food-catalog.mjs --input .data/foundation.ndjson --source usda_foundation --version "<USDA release>" --release-date YYYY-MM-DD
```

Repeat for `usda_fndds` and `usda_branded`. Do not commit `.data/` or raw FoodData Central exports.

## Data semantics

- `fdc_id` and `source_type` are preserved.
- Missing nutrients remain `null`; they are not converted to zero during ingestion.
- Known nutrients are mapped by numeric USDA nutrient ID and expected unit. Unknown nutrients remain available in `nutrient_data`.
- UPC/EAN values are normalized to digits while preserving leading zeros.
- Duplicate FDC IDs are deduplicated deterministically by the normalizer and rejected by staging if they reappear.
