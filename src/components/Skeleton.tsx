import { View } from 'react-native';

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = 'h-5 w-full' }: SkeletonProps) {
  return <View className={`rounded-pill bg-base-300 opacity-60 ${className}`} />;
}
