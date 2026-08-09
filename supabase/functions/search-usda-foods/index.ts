import {
  getFoodDataCentralDetails,
  searchFoodDataCentral,
  searchFoodDataCentralByBarcode,
} from '../_shared/usda-fdc.mjs';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

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
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const apiKey = Deno.env.get('USDA_FDC_API_KEY')?.trim();
  if (!apiKey) return json({ error: 'USDA_FDC_API_KEY is not configured on the backend.' }, 503);

  try {
    const body = await request.json();
    const action = body?.action === 'barcode' || body?.action === 'details'
      ? body.action
      : 'search';

    if (action === 'details') {
      const food = await getFoodDataCentralDetails({
        fdcId: Number(body?.fdcId),
        apiKey,
        signal: request.signal,
      });
      return json({ food });
    }

    if (action === 'barcode') {
      const foods = await searchFoodDataCentralByBarcode({
        barcode: String(body?.barcode ?? ''),
        apiKey,
        signal: request.signal,
      });
      return json({ foods });
    }

    const foods = await searchFoodDataCentral({
      query: String(body?.query ?? ''),
      apiKey,
      pageSize: body?.pageSize,
      pageNumber: body?.pageNumber,
      signal: request.signal,
    });
    return json({ foods });
  } catch (error) {
    console.error('search-usda-foods failed', error);
    const message = error instanceof Error ? error.message : 'FoodData Central request failed.';
    const status = /\(429\)/.test(message) ? 429 : /timed out/i.test(message) ? 504 : 502;
    return json({ error: message }, status);
  }
});
