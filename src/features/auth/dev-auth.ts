import type { Session, User } from '@supabase/supabase-js';

import type { AuthProfile } from '@/src/features/auth/auth-session-context';
import { LOCAL_DEV_USER_EMAIL, LOCAL_DEV_USER_ID } from '@/src/lib/runtime-flags';

export const LOCAL_DEV_PROFILE: AuthProfile = {
  id: LOCAL_DEV_USER_ID,
  primary_goal: 'Track performance',
};

const localDevUser = {
  id: LOCAL_DEV_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: LOCAL_DEV_USER_EMAIL,
  email_confirmed_at: new Date(0).toISOString(),
  phone: '',
  app_metadata: {
    provider: 'local-dev',
    providers: ['local-dev'],
  },
  user_metadata: {
    display_name: 'Local Dev',
  },
  identities: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
  is_anonymous: false,
} satisfies Partial<User>;

export const LOCAL_DEV_SESSION = {
  access_token: 'local-dev-access-token',
  refresh_token: 'local-dev-refresh-token',
  expires_in: 60 * 60 * 24 * 365,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  token_type: 'bearer',
  user: localDevUser,
} as Session;
