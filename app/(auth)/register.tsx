import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Badge } from '@/src/components/Badge';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Input } from '@/src/components/Input';
import { Screen } from '@/src/components/Screen';
import { USE_DEV_AUTH } from '@/src/lib/runtime-flags';
import { supabase } from '@/src/lib/supabase';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister() {
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
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
        },
      });

      if (error) {
        Alert.alert('Unable to create account', error.message);
        return;
      }

      if (data.user && data.session) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: displayName.trim() || null,
        });

        if (profileError) {
          Alert.alert('Account created, but profile setup failed', profileError.message);
          return;
        }
      }

      if (!data.session) {
        Alert.alert(
          'Confirm your email',
          'Open the confirmation email, then return here and sign in to finish onboarding.'
        );
        router.replace('/login');
        return;
      }

      router.replace('/onboarding');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check your Supabase configuration.';
      Alert.alert('Unable to reach Supabase', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-3">
          <Text className="text-base font-bold uppercase tracking-widest text-primary">
            Start strong
          </Text>
          <Text className="text-4xl font-display text-base-content">Create account</Text>
          <Text className="text-sm font-body leading-6 text-base-muted">
            Set up the basics now. Goals and targets can be refined later.
          </Text>
          {USE_DEV_AUTH ? (
            <View className="items-start">
              <Badge label="Account creation skipped locally" variant="success" />
            </View>
          ) : null}
        </View>

        <Card variant="highlighted" className="gap-4">
          <Input
            label="Display name"
            placeholder="Faris"
            value={displayName}
            onChangeText={setDisplayName}
          />
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
            placeholder="At least 8 characters"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Button
            title={USE_DEV_AUTH ? 'Continue in local dev mode' : isSubmitting ? 'Creating...' : 'Create account'}
            onPress={handleRegister}
            disabled={isSubmitting}
            loading={isSubmitting}
          />
        </Card>

        <Text className="text-center text-sm font-body text-base-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-primary">
            Sign in
          </Link>
        </Text>
      </View>
    </Screen>
  );
}
