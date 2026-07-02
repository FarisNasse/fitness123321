import { Pressable, Text, View } from 'react-native';

import { colors } from '@/src/lib/theme';

import { formatRecentSetLine } from '../liveWorkoutSelectors';
import type { LocalWorkoutSetRow } from '../liveWorkoutState';

export function RecentSetList({
  sets,
  onEdit,
}: {
  sets: LocalWorkoutSetRow[];
  onEdit: (set: LocalWorkoutSetRow) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.baseContent, fontSize: 20, fontWeight: '900' }}>Recent sets</Text>

      {sets.length === 0 ? (
        <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>No sets yet.</Text>
      ) : (
        <View style={{ gap: 6 }}>
          {sets.map((set) => (
            <Pressable
              key={set.local_id}
              onPress={() => onEdit(set)}
              style={({ pressed }) => ({
                alignItems: 'center',
                backgroundColor: pressed ? colors.base300 : colors.base100,
                borderColor: colors.base300,
                borderRadius: 12,
                borderWidth: 1,
                flexDirection: 'row',
                justifyContent: 'space-between',
                minHeight: 48,
                paddingHorizontal: 14,
              })}
            >
              <Text style={{ color: colors.baseContent, fontSize: 17, fontWeight: '900' }}>
                {formatRecentSetLine(set)}
              </Text>
              <Text style={{ color: colors.primary, fontWeight: '900' }}>Edit</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
