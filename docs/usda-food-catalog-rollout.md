# USDA FoodData Central rollout

The USDA catalog is an extension of the existing nutrition architecture, not a replacement for meal history. Existing local meal logs and legacy `public.foods` remain valid during rollout.

## Deploy

1. Apply `supabase/migrations/0006_add_usda_food_catalog.sql`.
2. Import Foundation, FNDDS, and Branded releases with `scripts/food-data/`.
3. Confirm `food_data_imports.status = 'completed'` for each source and smoke-test `search_food_catalog` plus `search_food_by_barcode`.
4. Keep production clients on the existing source until the catalog is populated and verified.
5. Set `EXPO_PUBLIC_FOOD_SOURCE=usda` for preview builds first, then production after validation.

The mobile client never needs `USDA_FDC_API_KEY` or the Supabase service-role key. Those credentials are backend/operator-only.

## Rollback

Set `EXPO_PUBLIC_FOOD_SOURCE=supabase` (or `local` for local-only development). The legacy `public.foods` path remains intact. Catalog migration does not rewrite historical nutrition snapshots.
