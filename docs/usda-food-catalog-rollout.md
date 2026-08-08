# USDA FoodData Central rollout

Food search now uses a layered online-first architecture. Bulk PostgreSQL imports improve speed and ranking, but **they are no longer required for search to return FoodData Central results**.

## Search order

1. Search the normalized Supabase `food_catalog` when available.
2. Fill missing results through the `search-usda-foods` Supabase Edge Function, which queries the official FoodData Central `/foods/search` API.
3. In non-production development only, use USDA's public `DEMO_KEY` if the Edge Function is not deployed yet. This is intentionally rate-limited and is only a development safety net.
4. Use SQLite cached/recent foods when the network search layers are unavailable.

This means a fresh online app can search common terms such as `apple` and `yogurt` without first loading a multi-gigabyte USDA bulk export into PostgreSQL.

## Required production deployment

1. Obtain a FoodData Central API key from data.gov.
2. Configure it as a Supabase server secret; never expose it as `EXPO_PUBLIC_*`:

   ```bash
   supabase secrets set USDA_FDC_API_KEY=YOUR_KEY
   ```

3. Deploy the search proxy:

   ```bash
   supabase functions deploy search-usda-foods
   ```

4. Apply `0006_add_usda_food_catalog.sql` and `0007_expand_usda_sources.sql`.
5. Set `EXPO_PUBLIC_FOOD_SOURCE=usda` (this is now the repository default).

The client uses the project's normal Supabase URL and anon key to invoke the Edge Function. The FoodData Central API key stays on the backend.

## Optional bulk-catalog acceleration

For lower latency and better application-controlled ranking, import Foundation, FNDDS, Branded, SR Legacy, and/or Experimental releases with `scripts/food-data/`. The PostgreSQL catalog is a performance and resilience layer; it is not a gate that must be populated before food search works.

## Offline behavior

SQLite stores foods the user has searched, selected, or logged. Offline search is intentionally limited to those cached foods, recents, favorites/custom foods, and existing meal history. The full USDA catalog is an online data source and is not bundled into the mobile application.
