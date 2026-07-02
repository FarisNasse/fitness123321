import { Text, View } from 'react-native';

import { colors } from '@/src/lib/theme';

import { rgba } from '../liveWorkoutFormatting';

export function SavedSetNotice({ notice }: { notice: string }) {
  return (
    <View
      style={{
        backgroundColor: rgba(34, 197, 94, 0.12),
        borderColor: rgba(34, 197, 94, 0.25),
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
      }}
    >
      <Text style={{ color: colors.baseContent, fontWeight: '900' }}>{notice}</Text>
    </View>
  );
}
