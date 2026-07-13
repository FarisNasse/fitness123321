import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Input } from '@/src/components/Input';
import { Screen } from '@/src/components/Screen';
import { createRecoverySessionFromUrl } from '@/src/features/auth/password-recovery';
import { reportProviderError } from '@/src/lib/error-reporting';
import { useNetworkState } from '@/src/lib/network-state';
import { supabase } from '@/src/lib/supabase';

type RecoveryState = 'checking' | 'ready' | 'saving' | 'success' | 'error';

export default function ResetPasswordScreen() {
  const recoveryUrl = Linking.useLinkingURL();
  const handledUrlRef = useRef<string | null>(null);
  const [state, setState] = useState<RecoveryState>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const { status: networkStatus } = useNetworkState();

  useEffect(() => {
    if (recoveryUrl) return;

    const timeout = setTimeout(() => {
      if (handledUrlRef.current) return;

      setErrorMessage('No password-recovery link was provided.');
      setState('error');
    }, 750);

    return () => clearTimeout(timeout);
  }, [recoveryUrl]);

  useEffect(() => {
    if (!recoveryUrl || handledUrlRef.current === recoveryUrl) {
      return;
    }

    handledUrlRef.current = recoveryUrl;
    let isActive = true;

    void createRecoverySessionFromUrl(recoveryUrl).then(
      () => {
        if (isActive) setState('ready');
      },
      () => {
        if (!isActive) return;
        setErrorMessage('This recovery link is invalid or has expired.');
        setState('error');
      }
    );

    return () => {
      isActive = false;
    };
  }, [recoveryUrl]);

  async function handleUpdatePassword() {
    if (password.length < 8) {
      setErrorMessage('Use a password with at least 8 characters.');
      return;
    }

    if (password !== confirmation) {
      setErrorMessage('The passwords do not match.');
      return;
    }

    setErrorMessage('');
    setState('saving');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(
        reportProviderError(
          error,
          { source: 'reset-password-screen', operation: 'update-password', domain: 'auth' },
          {
            offline: networkStatus === 'offline',
            fallback: 'We couldn’t update your password. Request a new link and try again.',
          }
        )
      );
      setState('ready');
      return;
    }

    setState('success');
  }

  function restartRecovery() {
    router.replace('/forgot-password');
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-3">
          <Text className="text-base font-bold uppercase tracking-widest text-primary">
            Secure recovery
          </Text>
          <Text className="text-4xl font-display text-base-content">Choose a new password</Text>
        </View>

        <Card variant="highlighted" className="gap-4">
          {state === 'checking' ? (
            <Text className="text-sm font-body leading-6 text-base-muted">
              Verifying your recovery link...
            </Text>
          ) : null}

          {state === 'error' ? (
            <View className="gap-4">
              <Text className="text-xl font-bold text-error">Link unavailable</Text>
              <Text className="text-sm font-body leading-6 text-base-muted">
                {errorMessage || 'This recovery link is invalid or has expired.'}
              </Text>
              <Button title="Request a new link" onPress={restartRecovery} />
              <Button title="Back to sign in" variant="ghost" onPress={() => router.replace('/login')} />
            </View>
          ) : null}

          {state === 'ready' || state === 'saving' ? (
            <>
              <Input
                autoComplete="new-password"
                label="New password"
                placeholder="At least 8 characters"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <Input
                autoComplete="new-password"
                label="Confirm new password"
                placeholder="Enter it again"
                secureTextEntry
                value={confirmation}
                onChangeText={setConfirmation}
                error={errorMessage || undefined}
              />
              <Button
                title={state === 'saving' ? 'Updating...' : 'Update password'}
                onPress={handleUpdatePassword}
                disabled={state === 'saving'}
                loading={state === 'saving'}
              />
            </>
          ) : null}

          {state === 'success' ? (
            <View className="gap-4">
              <Text className="text-xl font-bold text-base-content">Password updated</Text>
              <Text className="text-sm font-body leading-6 text-base-muted">
                Your new password is active and your account is ready.
              </Text>
              <Button title="Continue to the app" onPress={() => router.replace('/')} />
            </View>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}
