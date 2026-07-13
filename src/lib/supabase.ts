import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { reportConfigurationIssue } from '@/src/lib/error-reporting';
import { USE_DEV_AUTH } from '@/src/lib/runtime-flags';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const fallbackSupabaseUrl = 'https://local-dev.supabase.co';
const fallbackSupabaseAnonKey = 'local-dev-anon-key';

if ((!supabaseUrl || !supabaseAnonKey) && !USE_DEV_AUTH) {
  reportConfigurationIssue(
    'Supabase mode is enabled without EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    'supabase-client'
  );
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
