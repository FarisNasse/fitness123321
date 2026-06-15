import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { supabase } from '@/src/lib/supabase';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }

    setIsSubmitting(true);
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
      setIsSubmitting(false);
      Alert.alert('Unable to create account', error.message);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName.trim() || null,
      });
    }

    setIsSubmitting(false);
    router.replace('/onboarding');
  }

  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontSize: 32, fontWeight: '800' }}>Create account</Text>
          <Text style={{ marginTop: 8, color: '#64748b' }}>
            Start with the basics. You can refine goals later.
          </Text>
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
              title={isSubmitting ? 'Creating...' : 'Create account'}
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
