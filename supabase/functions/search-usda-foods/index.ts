// @ts-nocheck
import {
  searchFoodDataCentral,
  searchFoodDataCentralByBarcode,
} from '../_shared/usda-fdc.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const apiKey = Deno.env.get('USDA_FDC_API_KEY')?.trim();
  if (!apiKey) {
    return json({ error: 'USDA_FDC_API_KEY is not configured on the backend.' }, 503);
  }

  try {
    const body = await request.json();
    const action = body?.action === 'barcode' ? 'barcode' : 'search';

    if (action === 'barcode') {
      const foods = await searchFoodDataCentralByBarcode({
        barcode: String(body?.barcode ?? ''),
        apiKey,
      });
      return json({ foods });
    }

    const foods = await searchFoodDataCentral({
      query: String(body?.query ?? ''),
      apiKey,
      pageSize: body?.pageSize,
      pageNumber: body?.pageNumber,
    });
    return json({ foods });
  } catch (error) {
    console.error('search-usda-foods failed', error);
    return json(
      { error: error instanceof Error ? error.message : 'FoodData Central search failed.' },
      502
    );
  }
});
