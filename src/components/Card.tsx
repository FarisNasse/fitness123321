import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export function Card({ children }: PropsWithChildren) {
  return (
    <View
      style={{
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}
