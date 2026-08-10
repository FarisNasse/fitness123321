import { useEffect, useRef } from 'react';
import type { View } from 'react-native';
import { Platform } from 'react-native';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type FocusTarget = {
  focus?: () => void;
};

type FocusRoot = FocusTarget & {
  querySelectorAll: (selector: string) => ArrayLike<FocusTarget>;
  addEventListener: (type: 'keydown', listener: (event: KeyEvent) => void) => void;
  removeEventListener: (type: 'keydown', listener: (event: KeyEvent) => void) => void;
};

type KeyEvent = {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
};

type WebDocument = {
  activeElement?: FocusTarget | null;
};

export function useModalFocusTrap(visible: boolean) {
  const ref = useRef<View | null>(null);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;

    const documentObject = (globalThis as typeof globalThis & { document?: WebDocument }).document;
    const root = ref.current as unknown as FocusRoot | null;
    if (!documentObject || !root) return;

    const previouslyFocused = documentObject.activeElement ?? null;
    const getFocusable = () => Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
    const initial = getFocusable()[0] ?? root;
    initial.focus?.();

    const handleKeyDown = (event: KeyEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        root.focus?.();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && documentObject.activeElement === first) {
        event.preventDefault();
        last.focus?.();
      } else if (!event.shiftKey && documentObject.activeElement === last) {
        event.preventDefault();
        first.focus?.();
      }
    };

    root.addEventListener('keydown', handleKeyDown);
    return () => {
      root.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [visible]);

  return ref;
}
