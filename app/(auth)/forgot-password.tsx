import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Input } from '@/src/components/Input';
import { Screen } from '@/src/components/Screen';
import { requestPasswordRecovery } from '@/src/features/auth/password-recovery';
import { reportProviderError } from '@/src/lib/error-reporting';
import { useNetworkState } from '@/src/lib/network-state';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestComplete, setRequestComplete] = useState(false);
  const { status: networkStatus } = useNetworkState();

  async function handleRequest() {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      Alert.alert('Missing email', 'Enter the email address for your account.');
      return;
    }

    setIsSubmitting(true);

    try {
      await requestPasswordRecovery(normalizedEmail);
      setRequestComplete(true);
    } catch (error) {
      const message = reportProviderError(
        error,
        { source: 'forgot-password-screen', operation: 'request-recovery', domain: 'auth' },
        {
          offline: networkStatus === 'offline',
          fallback: 'We couldn’t send a recovery link right now. Please try again.',
        }
      );
      Alert.alert('Unable to send reset link', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-3">
          <Text className="text-base font-bold uppercase tracking-widest text-primary">
            Account recovery
          </Text>
          <Text className="text-4xl font-display text-base-content">Reset password</Text>
          <Text className="text-sm font-body leading-6 text-base-muted">
            Enter your account email and we will send a secure recovery link.
          </Text>
        </View>

        <Card variant="highlighted" className="gap-4">
          {requestComplete ? (
            <View className="gap-3">
              <Text className="text-xl font-bold text-base-content">Check your email</Text>
              <Text className="text-sm font-body leading-6 text-base-muted">
                If an account exists for {email.trim()}, its reset link is on the way. Open
                the link on a device with this app installed.
              </Text>
              <Button title="Send another link" variant="outline" onPress={handleRequest} />
            </View>
          ) : (
            <>
              <Input
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
              />
              <Button
                title={isSubmitting ? 'Sending...' : 'Send recovery link'}
                onPress={handleRequest}
                disabled={isSubmitting}
                loading={isSubmitting}
              />
            </>
          )}
        </Card>

        <Link href="/login" className="text-center text-sm font-bold text-primary">
          Back to sign in
        </Link>
      </View>
    </Screen>
  );
}
