# search-usda-foods

Backend-only FoodData Central proxy used by the nutrition search service.

Deploy with:

```bash
supabase secrets set USDA_FDC_API_KEY=YOUR_KEY
supabase functions deploy search-usda-foods
```

The mobile/web client invokes this function with the normal Supabase anon/session credentials. The USDA API key is read only from the function environment.
