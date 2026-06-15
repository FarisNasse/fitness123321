import { Pressable, Text } from 'react-native';

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
};

export function Button({ title, onPress, disabled = false }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: disabled ? '#94a3b8' : '#0f172a',
        opacity: pressed ? 0.85 : 1,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 18,
        alignItems: 'center',
      })}
    >
      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>
        {title}
      </Text>
    </Pressable>
  );
}
