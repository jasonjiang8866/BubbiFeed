import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

import AppIcon from '@/components/app-icon';
import { Colors } from '@/constants/theme';

/**
 * Bottom tab navigator (native: Android & iOS).
 *
 * Uses expo-router's standard JS `Tabs` with Lucide icons so the icons render
 * identically and crisply on every platform (the previous unstable NativeTabs +
 * raster PNGs rendered as fallback blobs on Android).
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.cardBorder,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <AppIcon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="logger"
        options={{
          title: 'Log Feed',
          tabBarIcon: ({ color, size }) => <AppIcon name="milk" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <AppIcon name="history" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => <AppIcon name="insights" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <AppIcon name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
