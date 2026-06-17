import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { USE_DEV_AUTH } from '@/src/lib/runtime-flags';
import { supabase } from '@/src/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        Alert.alert('Unable to sign in', error.message);
        return;
      }

      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check your Supabase configuration.';
      Alert.alert('Unable to reach Supabase', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Welcome back</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Sign in to continue tracking workouts, meals, and progress.
          </Text>
          {USE_DEV_AUTH ? (
            <Text style={{ marginTop: 8, color: '#059669', fontWeight: '700' }}>
              Local dev auth is on. The app will skip Supabase login and use a local demo user.
            </Text>
          ) : null}
        </View>

        <Card>
          <View style={{ gap: 12 }}>
            <Text style={{ fontWeight: '700' }}>Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              style={inputStyle}
            />

            <Text style={{ fontWeight: '700' }}>Password</Text>
            <TextInput
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={inputStyle}
            />

            <Button
              title={USE_DEV_AUTH ? 'Continue in local dev mode' : isSubmitting ? 'Signing in...' : 'Sign in'}
              onPress={handleLogin}
              disabled={isSubmitting}
            />
          </View>
        </Card>

        <Text style={{ textAlign: 'center' }}>
          New here? <Link href="/register">Create an account</Link>
        </Text>
      </View>
    </Screen>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: '#cbd5e1',
  borderRadius: 12,
  padding: 12,
};
