import { Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { colors } from '@/src/lib/theme';

export function NoExerciseState({ onAddExercise }: { onAddExercise: () => void }) {
  return (
    <Card>
      <View style={{ gap: 14 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.baseContent, fontSize: 26, fontWeight: '900' }}>
            Start logging
          </Text>
          <Text style={{ color: colors.baseMuted, fontWeight: '800' }}>Add your first exercise.</Text>
        </View>
        <Button title="Add first exercise" onPress={onAddExercise} size="lg" />
      </View>
    </Card>
  );
}
