import type { ReactNode } from 'react';
import { Modal, Pressable } from 'react-native';

import { colors } from '@/src/lib/theme';
import { useModalFocusTrap } from '@/src/lib/use-modal-focus-trap';

export function BaseSheet({
  visible,
  onClose,
  children,
  accessibilityLabel = 'Dialog',
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  const modalRef = useModalFocusTrap(visible);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable
        onPress={onClose}
        accessible={false}
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          flex: 1,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          ref={modalRef}
          tabIndex={-1}
          onPress={(event) => event.stopPropagation()}
          accessibilityRole="dialog"
          accessibilityLabel={accessibilityLabel}
          accessibilityViewIsModal
          accessible={false}
          style={{
            backgroundColor: colors.base200,
            borderColor: colors.base300,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            maxHeight: '88%',
            overflow: 'hidden',
            padding: 20,
            paddingBottom: 34,
          }}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const sheetInputStyle = {
  backgroundColor: colors.base100,
  borderWidth: 1,
  borderColor: colors.base300,
  color: colors.baseContent,
  borderRadius: 14,
  fontSize: 18,
  fontWeight: '800' as const,
  padding: 14,
};
