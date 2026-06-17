import { Text, View } from 'react-native';

type EmptyStateProps = {
  title: string;
  message: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <View className="items-center gap-3 rounded-card border border-dashed border-base-300 bg-base-100 p-5">
      <View className="h-2 w-16 rounded-pill bg-primary" />
      <View className="gap-1">
        <Text className="text-center text-base font-bold text-base-content">{title}</Text>
        <Text className="text-center text-sm font-body leading-5 text-base-muted">
          {message}
        </Text>
      </View>
      {action}
    </View>
  );
}
