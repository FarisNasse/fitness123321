import * as Linking from 'expo-linking';

import { AUTH_REDIRECT_URL } from '@/src/lib/runtime-flags';
import { supabase } from '@/src/lib/supabase';

type RecoveryLinkParameters = {
  accessToken: string | null;
  authorizationCode: string | null;
  errorDescription: string | null;
  refreshToken: string | null;
  type: string | null;
};

function readParameters(value: string) {
  return new URLSearchParams(value.replace(/^[?#]/, ''));
}

export function parseRecoveryLink(url: string): RecoveryLinkParameters {
  const queryStart = url.indexOf('?');
  const fragmentStart = url.indexOf('#');
  const queryEnd = fragmentStart >= 0 ? fragmentStart : url.length;
  const query = queryStart >= 0
    ? readParameters(url.slice(queryStart + 1, queryEnd))
    : new URLSearchParams();
  const fragment = fragmentStart >= 0
    ? readParameters(url.slice(fragmentStart + 1))
    : new URLSearchParams();
  const get = (key: string) => fragment.get(key) ?? query.get(key);

  return {
    accessToken: get('access_token'),
    authorizationCode: get('code'),
    errorDescription: get('error_description') ?? get('error'),
    refreshToken: get('refresh_token'),
    type: get('type'),
  };
}

export function getPasswordRecoveryRedirectUrl() {
  return AUTH_REDIRECT_URL ?? Linking.createURL('reset-password');
}

export async function requestPasswordRecovery(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordRecoveryRedirectUrl(),
  });

  if (error) {
    throw error;
  }
}

export async function createRecoverySessionFromUrl(url: string) {
  const parameters = parseRecoveryLink(url);

  if (parameters.errorDescription) {
    throw new Error(parameters.errorDescription);
  }

  if (parameters.type && parameters.type !== 'recovery') {
    throw new Error('This link is not a password-recovery link.');
  }

  if (parameters.authorizationCode) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      parameters.authorizationCode
    );

    if (error || !data.session) {
      throw error ?? new Error('The recovery session could not be created.');
    }

    return data.session;
  }

  if (parameters.accessToken && parameters.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: parameters.accessToken,
      refresh_token: parameters.refreshToken,
    });

    if (error || !data.session) {
      throw error ?? new Error('The recovery session could not be created.');
    }

    return data.session;
  }

  throw new Error('This recovery link is incomplete, invalid, or has already been used.');
}
