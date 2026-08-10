import { Alert, Text, View } from 'react-native';
import { useState } from 'react';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { useAuthSession } from '@/src/features/auth/auth-session-context';
import {
  deleteAccountPermanently,
  exportAccountData,
} from '@/src/features/account/account-service';
import { reportError } from '@/src/lib/error-reporting';
import { USE_DEV_AUTH } from '@/src/lib/runtime-flags';
import { supabase } from '@/src/lib/supabase';

export default function SettingsScreen() {
  const { session } = useAuthSession();
  const userId = session?.user.id ?? null;
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function exportData() {
    if (!userId || exporting) return;
    setExporting(true);
    try {
      await exportAccountData(userId);
    } catch (error) {
      reportError(error, { source: 'settings-screen', operation: 'export-data', domain: 'account' });
      Alert.alert('Export failed', 'Your data could not be exported. Try again after syncing.');
    } finally {
      setExporting(false);
    }
  }

  function confirmDeleteAccount() {
    if (!userId || deleting) return;
    Alert.alert(
      'Permanently delete account?',
      'This permanently deletes your account and cloud fitness data. This action cannot be undone. Export your data first if you want to keep a copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final confirmation',
              'Delete this account and all associated cloud data now?',
              [
                { text: 'Keep account', style: 'cancel' },
                {
                  text: 'Delete account',
                  style: 'destructive',
                  onPress: () => void deleteAccount(),
                },
              ]
            );
          },
        },
      ]
    );
  }

  async function deleteAccount() {
    if (!userId || deleting) return;
    setDeleting(true);
    try {
      await deleteAccountPermanently(userId);
    } catch (error) {
      reportError(error, { source: 'settings-screen', operation: 'delete-account', domain: 'account' });
      Alert.alert('Deletion failed', error instanceof Error ? error.message : 'Your account could not be deleted.');
      setDeleting(false);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      reportError(error, { source: 'settings-screen', operation: 'sign-out', domain: 'auth' });
      Alert.alert('Sign out failed', 'The local session could not be cleared.');
    }
  }

  return (
    <Screen>
      <View className="gap-5">
        <View className="gap-2">
          <Text accessibilityRole="header" className="text-4xl font-display text-base-content">
            Settings
          </Text>
          <Text className="text-sm font-body leading-6 text-base-muted">
            Manage your account, export your records, or remove your data.
          </Text>
        </View>

        <Card className="gap-4">
          <Text accessibilityRole="header" className="text-xl font-black text-base-content">
            Your data
          </Text>
          <Text className="text-sm leading-6 text-base-muted">
            Export workouts, nutrition logs, water, wellness check-ins, measurements, and targets as portable JSON.
          </Text>
          <Button title="Export my data" onPress={exportData} loading={exporting} />
        </Card>

        <Card className="gap-4">
          <Text accessibilityRole="header" className="text-xl font-black text-base-content">
            Session
          </Text>
          <Text className="text-sm text-base-muted" selectable>
            {session?.user.email ?? 'Signed-in account'}
          </Text>
          {!USE_DEV_AUTH ? <Button title="Sign out" onPress={signOut} variant="outline" /> : null}
        </Card>

        <Card className="gap-4">
          <Text accessibilityRole="header" className="text-xl font-black text-error">
            Delete account
          </Text>
          <Text className="text-sm leading-6 text-base-muted">
            Permanent deletion removes the authentication account and owned cloud records. Local records for this account are cleared after the server confirms deletion.
          </Text>
          <Button
            title="Delete account permanently"
            onPress={confirmDeleteAccount}
            variant="danger"
            loading={deleting}
            disabled={USE_DEV_AUTH}
            accessibilityHint={USE_DEV_AUTH ? 'Unavailable while development authentication is enabled.' : 'Requires two confirmations.'}
          />
        </Card>
      </View>
    </Screen>
  );
}
