import { Pressable, Text, View } from 'react-native';

import { colors } from '@/src/lib/theme';

import { rgba } from '../liveWorkoutFormatting';

export function SavedSetNotice({
  notice,
  actionLabel,
  onAction,
}: {
  notice: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
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
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
        <Text style={{ color: colors.baseContent, flex: 1, fontWeight: '900' }}>{notice}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={onAction}
            style={({ pressed }) => ({
              alignItems: 'center',
              borderColor: colors.success,
              borderRadius: 999,
              borderWidth: 1,
              justifyContent: 'center',
              minHeight: 44,
              minWidth: 78,
              opacity: pressed ? 0.75 : 1,
              paddingHorizontal: 14,
            })}
          >
            <Text style={{ color: colors.success, fontWeight: '900' }}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
