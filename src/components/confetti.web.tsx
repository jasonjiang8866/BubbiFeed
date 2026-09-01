import { forwardRef } from 'react';

/**
 * Web stub for the confetti celebration.
 *
 * The native implementation (confetti.tsx) runs on react-native-reanimated's
 * UI-thread worklets, which are bypassed for web in this project (same pattern
 * as animated-icon.web.tsx). Confetti is a non-essential, purely decorative
 * micro-interaction, so on web it is a no-op that still satisfies the
 * imperative ref API (`trigger()`).
 */

export interface ConfettiRef {
  trigger: () => void;
}

export const Confetti = forwardRef<ConfettiRef, {}>((props, ref) => {
  if (typeof ref === 'object' && ref) {
    ref.current = { trigger: () => {} };
  }
  return null;
});

export default Confetti;
