import type { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScreenProps = PropsWithChildren<{
  scrollable?: boolean;
  className?: string;
  contentClassName?: string;
}>;

export function Screen({
  children,
  scrollable = true,
  className = '',
  contentClassName = '',
}: ScreenProps) {
  const content = <View className={`flex-1 ${className}`}>{children}</View>;

  if (!scrollable) {
    return (
      <SafeAreaView className="flex-1 bg-base-100">
        {content}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-base-100">
      <ScrollView
        contentContainerClassName={`px-5 pt-5 pb-12 ${contentClassName}`}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    </SafeAreaView>
  );
}
