import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { USE_DEV_AUTH } from '@/src/lib/runtime-flags';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const fallbackSupabaseUrl = 'https://local-dev.supabase.co';
const fallbackSupabaseAnonKey = 'local-dev-anon-key';

if ((!supabaseUrl || !supabaseAnonKey) && !USE_DEV_AUTH) {
  console.warn('Missing Supabase environment variables. Set EXPO_PUBLIC_AUTH_MODE=local for local dev auth, or provide real Supabase credentials.');
}

export const supabase = createClient(
  supabaseUrl ?? fallbackSupabaseUrl,
  supabaseAnonKey ?? fallbackSupabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
