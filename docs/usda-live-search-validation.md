# USDA live search validation

This fix was validated against API-shaped FoodData Central search responses for `Apple` and `Yogurt`.

Local validation on the uploaded repository checkout:

- `node --test`: 164/164 passing
- `git diff --check`: clean
- live-search normalizer preserves FDC IDs and leading-zero barcodes
- development search no longer depends on a pre-populated SQLite cache

Production deployment still requires the `search-usda-foods` Edge Function and a server-side `USDA_FDC_API_KEY`; the key must never be exposed through `EXPO_PUBLIC_*`.
