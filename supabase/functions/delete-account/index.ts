import { createClient } from 'npm:@supabase/supabase-js@2.108.1';

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const authorization = request.headers.get('Authorization')?.trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Account deletion is not configured.' }, 503);
  }
  if (!authorization) return json({ error: 'Authentication is required.' }, 401);

  const body = await request.json().catch(() => null);
  if (body?.confirmation !== 'DELETE') {
    return json({ error: 'Explicit deletion confirmation is required.' }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.id) {
    return json({ error: 'The access token is invalid or expired.' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    console.error('delete-account failed', deleteError);
    return json({ error: 'The account could not be deleted.' }, 500);
  }

  // Every owned application table references auth.users with ON DELETE CASCADE.
  return json({ deleted: true });
});
