import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppIcon, { AppIconName } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Modern, non-blocking toast system (shadcn/sonner-style) for BubbiFeed.
 *
 * Replaces legacy `Alert.alert` success popups with a top banner card:
 * milk-white rounded card, tinted icon chip, title + description,
 * spring-in / fade-out via react-native-reanimated (release-safe),
 * auto-dismiss after ~2.6s. Max 3 stacked.
 */

export interface ToastOptions {
  title: string;
  description?: string;
  icon?: AppIconName;
  /** Theme color key used to tint the icon chip. Default 'success'. */
  tone?: ThemeColor;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<{ show: (o: ToastOptions) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();
  const colors = useTheme();

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (o: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-2), { ...o, id }]);
      setTimeout(() => dismiss(id), o.duration ?? 2600);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={[styles.overlay, { top: insets.top + 8 }]} pointerEvents="none">
        {toasts.map((t) => {
          const tone = colors[t.tone ?? 'success'];
          return (
            <Animated.View
              key={t.id}
              entering={FadeInDown.duration(350).springify()}
              exiting={FadeOutUp.duration(250)}
              style={[
                styles.toast,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View style={[styles.iconChip, { backgroundColor: tone + '26' }]}>
                <AppIcon name={t.icon ?? 'milk'} size={18} color={tone} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="bold" style={styles.title}>
                  {t.title}
                </ThemedText>
                {t.description ? (
                  <ThemedText type="small" style={styles.description}>
                    {t.description}
                  </ThemedText>
                ) : null}
              </View>
            </Animated.View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
  },
  description: {
    marginTop: 2,
  },
});
