import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Input } from '@/src/components/Input';
import { Screen } from '@/src/components/Screen';
import { reportProviderError } from '@/src/lib/error-reporting';
import { useNetworkState } from '@/src/lib/network-state';
import { USE_DEV_AUTH } from '@/src/lib/runtime-flags';
import { supabase } from '@/src/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { status: networkStatus } = useNetworkState();

  async function handleLogin() {
    if (USE_DEV_AUTH) {
      router.replace('/dashboard');
      return;
    }

    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const message = reportProviderError(
          error,
          { source: 'login-screen', operation: 'sign-in', domain: 'auth' },
          {
            offline: networkStatus === 'offline',
            fallback: 'We couldn’t sign you in. Check your details and try again.',
          }
        );
        Alert.alert('Unable to sign in', message);
        return;
      }

      router.replace('/');
    } catch (error) {
      const message = reportProviderError(
        error,
        { source: 'login-screen', operation: 'sign-in', domain: 'auth' },
        {
          offline: networkStatus === 'offline',
          fallback: 'Sign-in is temporarily unavailable. Please try again.',
        }
      );
      Alert.alert('Unable to sign in', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-3">
          <Text className="text-base font-bold uppercase tracking-widest text-primary">
            All-in-one fitness
          </Text>
          <Text className="text-4xl font-display text-base-content">Welcome back</Text>
          <Text className="text-sm font-body leading-6 text-base-muted">
            Sign in to continue tracking workouts, meals, recovery, and progress.
          </Text>
          {USE_DEV_AUTH ? (
            <View className="items-start">
              <Badge label="Local dev mode" variant="success" />
            </View>
          ) : null}
        </View>

        <Card variant="highlighted" className="gap-4">
          <Input
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password"
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {!USE_DEV_AUTH ? (
            <Link href="/forgot-password" className="self-end text-sm font-bold text-primary">
              Forgot password?
            </Link>
          ) : null}

          <Button
            title={USE_DEV_AUTH ? 'Continue in local dev mode' : isSubmitting ? 'Signing in...' : 'Sign in'}
            onPress={handleLogin}
            disabled={isSubmitting}
            loading={isSubmitting}
          />
        </Card>

        <Text className="text-center text-sm font-body text-base-muted">
          New here?{' '}
          <Link href="/register" className="font-bold text-primary">
            Create an account
          </Link>
        </Text>
      </View>
    </Screen>
  );
}
