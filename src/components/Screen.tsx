import type { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
        }}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
