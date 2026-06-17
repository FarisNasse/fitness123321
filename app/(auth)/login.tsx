import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { supabase } from '@/src/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (error) {
      Alert.alert('Unable to sign in', error.message);
      return;
    }

    router.replace('/');
  }

  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Welcome back</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Sign in to continue tracking workouts, meals, and progress.
          </Text>
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
              title={isSubmitting ? 'Signing in...' : 'Sign in'}
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
