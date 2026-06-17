import { Text, View } from 'react-native';

import { Badge } from './Badge';
import { Card } from './Card';

type PersonalRecord = {
  exercise: string;
  value: string;
};

type PRCardProps = {
  records: PersonalRecord[];
};

export function PRCard({ records }: PRCardProps) {
  return (
    <Card className="gap-3">
      {records.map((record) => (
        <View
          key={record.exercise}
          className="flex-row items-center justify-between gap-3 rounded-card border border-base-300 bg-base-100 p-3"
        >
          <View className="flex-1">
            <Text className="text-base font-bold text-base-content">
              {record.exercise}
            </Text>
            <Text className="text-sm font-black text-primary">{record.value}</Text>
          </View>
          <Badge label="PR" variant="warning" />
        </View>
      ))}
    </Card>
  );
}
