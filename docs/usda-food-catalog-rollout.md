# USDA FoodData Central rollout

Food search uses the live FoodData Central service for discovery and keeps PostgreSQL/SQLite as acceleration and resilience layers. A search hit is **not** treated as a finished nutrition record: the selected USDA item is hydrated through Food Details before it can be logged.

## Search and selection flow

1. Discover USDA foods through the `search-usda-foods` Supabase Edge Function, which proxies the official `/foods/search` API.
2. Merge the user's custom foods in a separate UI section instead of pretending custom, PostgreSQL, and USDA relevance scores are comparable.
3. Page USDA discovery results explicitly (`25` at a time in the current UI).
4. When the user selects a USDA result, retrieve `/food/{fdcId}` through the same Edge Function and use that complete record for serving choices and logging.
5. If the live provider is unavailable, fall back to the owner-scoped PostgreSQL/SQLite cache where applicable.
6. USDA `DEMO_KEY` fallback is **disabled by default**. It is available only in non-production development when `EXPO_PUBLIC_ALLOW_USDA_DEMO_KEY=true` is set explicitly.

A fresh production deployment therefore needs the Edge Function and a real USDA API key; it does not need a multi-gigabyte bulk import before name search works.

## Required production deployment

1. Obtain a FoodData Central API key from data.gov.
2. Configure it as a Supabase server secret; never expose it as `EXPO_PUBLIC_*`:

   ```bash
   supabase secrets set USDA_FDC_API_KEY=YOUR_KEY
   ```

3. Deploy the search/details/barcode proxy:

   ```bash
   supabase functions deploy search-usda-foods
   ```

4. Apply migrations through `0008_fix_usda_catalog_integrity.sql`.
5. Set `EXPO_PUBLIC_FOOD_SOURCE=usda` (the repository default).

The client uses the project's normal Supabase URL and anon key to invoke the Edge Function. The FoodData Central API key stays on the backend.

## Optional bulk-catalog acceleration

For lower latency and resilience, import Foundation, FNDDS, Branded, SR Legacy, and/or Experimental releases with `scripts/food-data/`. Imported core nutrient columns remain explicitly per 100 g; serving choices are stored separately. A completed full-source import reconciles the prior release so records missing from the new release are retired rather than left searchable forever.

The PostgreSQL catalog is a fallback/acceleration layer. It does not suppress fresh live USDA discovery simply because a local page is full.

## Barcode behavior

The nutrition screen supports camera scanning through `expo-camera` plus manual GTIN entry. Retail GTINs are structurally validated, equivalent zero-padded forms are compared, UPC-E aliases are considered, and live barcode lookup is restricted to Branded Foods. Duplicate USDA product versions are hydrated and sorted by publication/update date rather than blindly choosing the first numeric-search hit.

## Offline and account isolation

SQLite stores foods the user has selected or logged and custom foods for that account. Cached/recent food queries are owner-scoped so one account cannot surface another account's private custom-food data after an account switch. Offline name search covers both food name and brand and is intentionally limited to the current account's cache and custom foods.

The full USDA catalog remains an online data source and is not bundled into the mobile application.
