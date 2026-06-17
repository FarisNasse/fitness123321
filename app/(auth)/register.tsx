import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
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

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: displayName.trim() || null,
        });
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
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Create account</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Start with the basics. You can refine goals later.
          </Text>
          {USE_DEV_AUTH ? (
            <Text style={{ marginTop: 8, color: '#059669', fontWeight: '700' }}>
              Local dev auth is on. Account creation is skipped until Supabase auth is enabled.
            </Text>
          ) : null}
        </View>

        <Card>
          <View style={{ gap: 12 }}>
            <Text style={{ fontWeight: '700' }}>Display name</Text>
            <TextInput
              placeholder="Faris"
              value={displayName}
              onChangeText={setDisplayName}
              style={inputStyle}
            />

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
              placeholder="At least 8 characters"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={inputStyle}
            />

            <Button
              title={USE_DEV_AUTH ? 'Continue in local dev mode' : isSubmitting ? 'Creating...' : 'Create account'}
              onPress={handleRegister}
              disabled={isSubmitting}
            />
          </View>
        </Card>

        <Text style={{ textAlign: 'center' }}>
          Already have an account? <Link href="/login">Sign in</Link>
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
