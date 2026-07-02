import { Pressable, Text, View } from 'react-native';

import { colors } from '@/src/lib/theme';

import { formatClock, formatShortClock, rgba } from '../liveWorkoutFormatting';
import type { LiveWorkoutController } from '../liveWorkoutState';

export function LiveWorkoutHeader({ controller }: { controller: LiveWorkoutController }) {
  return (
    <View
      style={{
        borderBottomColor: colors.base300,
        borderBottomWidth: 1,
        gap: 8,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 12,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 96 }}>
          <Text style={{ color: colors.baseContent, fontSize: 24, fontWeight: '900' }}>
            {controller.session.name ?? 'Quick workout'}
          </Text>
          <Text style={{ color: colors.baseMuted, fontWeight: '800', marginTop: 2 }}>
            {formatClock(controller.elapsedSeconds)} · {controller.sets.length} set{controller.sets.length === 1 ? '' : 's'} logged
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Finish workout"
          accessibilityRole="button"
          onPress={controller.openFinishSheet}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: pressed ? colors.base300 : 'transparent',
            borderRadius: 999,
            justifyContent: 'center',
            minHeight: 44,
            minWidth: 44,
          })}
        >
          <Text style={{ color: colors.baseContent, fontSize: 26, fontWeight: '900' }}>⋯</Text>
        </Pressable>
      </View>

      <RestTimerStrip restSeconds={controller.restSeconds} onSkip={controller.skipRest} />
    </View>
  );
}

function RestTimerStrip({ restSeconds, onSkip }: { restSeconds: number | null; onSkip: () => void }) {
  if (restSeconds === null) return null;

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: rgba(163, 230, 53, 0.12),
        borderColor: rgba(163, 230, 53, 0.26),
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 9,
      }}
    >
      <Text style={{ color: colors.baseContent, fontSize: 16, fontWeight: '900' }}>
        Rest {formatShortClock(restSeconds)}
      </Text>
      <Pressable
        onPress={onSkip}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.base300 : colors.base100,
          borderColor: colors.base300,
          borderRadius: 12,
          borderWidth: 1,
          paddingHorizontal: 12,
          paddingVertical: 7,
        })}
      >
        <Text style={{ color: colors.primary, fontWeight: '900' }}>Skip</Text>
      </Pressable>
    </View>
  );
}
