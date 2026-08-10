import { ActivityIndicator, Pressable, Text } from 'react-native';
import type { PressableProps } from 'react-native';

import { colors } from '@/src/lib/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = PressableProps & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary border border-primary',
  secondary: 'bg-secondary border border-secondary',
  ghost: 'bg-transparent border border-base-300',
  danger: 'bg-error border border-error',
  outline: 'bg-transparent border border-primary',
};

const textClasses: Record<ButtonVariant, string> = {
  primary: 'text-primary-content',
  secondary: 'text-secondary-content',
  ghost: 'text-base-content',
  danger: 'text-white',
  outline: 'text-primary',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'py-2 px-4',
  md: 'py-3 px-5',
  lg: 'py-4 px-7',
};

const textSizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

const spinnerColors: Record<ButtonVariant, string> = {
  primary: colors.primaryContent,
  secondary: colors.secondaryContent,
  ghost: colors.baseContent,
  danger: '#ffffff',
  outline: colors.primary,
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      accessibilityRole={props.accessibilityRole ?? 'button'}
      accessibilityLabel={props.accessibilityLabel ?? title}
      accessibilityState={{ disabled: Boolean(isDisabled), ...props.accessibilityState }}
      className={`
        min-h-11 rounded-pill items-center justify-center flex-row gap-2
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${isDisabled ? 'opacity-40' : 'active:opacity-75'}
        ${className}
      `}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColors[variant]} />
      ) : null}
      <Text className={`font-bold ${textClasses[variant]} ${textSizeClasses[size]}`}>
        {title}
      </Text>
    </Pressable>
  );
}
