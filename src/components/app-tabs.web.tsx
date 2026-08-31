import {
  TabList,
  TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';

import AppIcon, { type AppIconName } from './app-icon';
import { ExternalLink } from './external-link';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768; // Tablet/Mobile threshold

  return (
    <Tabs>
      <TabSlot
        style={{
          height: '100%',
          paddingTop: isMobile ? 0 : 76,
          paddingBottom: isMobile ? 80 : 0,
        }}
      />
      <TabList asChild>
        <CustomTabList isMobile={isMobile}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton isMobile={isMobile} label="Home" icon="home" />
          </TabTrigger>
          <TabTrigger name="logger" href="/logger" asChild>
            <TabButton isMobile={isMobile} label="Log Feed" icon="milk" />
          </TabTrigger>
          <TabTrigger name="history" href="/history" asChild>
            <TabButton isMobile={isMobile} label="History" icon="history" />
          </TabTrigger>
          <TabTrigger name="insights" href="/insights" asChild>
            <TabButton isMobile={isMobile} label="Insights" icon="insights" />
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton isMobile={isMobile} label="Settings" icon="settings" />
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

interface CustomTabButtonProps extends TabTriggerSlotProps {
  label: string;
  icon: AppIconName;
  isMobile: boolean;
}

export function TabButton({ label, icon, isMobile, isFocused, ...props }: CustomTabButtonProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const iconColor = isFocused ? colors.text : colors.textSecondary;
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.tabButtonPressable,
        isMobile && styles.tabButtonMobilePressable,
        { transform: [{ scale: pressed ? 0.93 : 1 }] },
        pressed && styles.pressed,
      ]}
    >
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[
          styles.tabButtonView,
          isMobile ? styles.tabButtonMobileView : styles.tabButtonDesktopView,
        ]}
      >
        {isMobile && (
          <View style={styles.mobileIcon}>
            <AppIcon name={icon} size={20} color={iconColor} />
          </View>
        )}
        <ThemedText
          type={isMobile ? 'code' : 'small'}
          style={[styles.labelText, { fontSize: isMobile ? 10 : 13 }]}
          themeColor={isFocused ? 'text' : 'textSecondary'}
        >
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

interface CustomTabListProps extends TabListProps {
  isMobile: boolean;
}

export function CustomTabList({ children, isMobile, ...props }: CustomTabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <View
      {...props}
      style={[
        styles.tabListContainer,
        isMobile ? styles.tabListMobileContainer : styles.tabListDesktopContainer,
      ]}
    >
      <ThemedView
        type="backgroundElement"
        style={[
          styles.innerContainer,
          isMobile ? styles.innerMobileContainer : styles.innerDesktopContainer,
        ]}
      >
        {!isMobile && (
          <ThemedText type="smallBold" style={styles.brandText}>
            FeedMyBaby
          </ThemedText>
        )}

        {children}

        {!isMobile && (
          <ExternalLink href="https://docs.expo.dev" asChild>
            <Pressable style={styles.externalPressable}>
              <ThemedText type="link">Docs</ThemedText>
              <SymbolView
                tintColor={colors.text}
                name={{ ios: 'arrow.up.right.square', web: 'link' }}
                size={12}
              />
            </Pressable>
          </ExternalLink>
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    zIndex: 100,
  },
  tabListMobileContainer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    padding: Spacing.two,
    zIndex: 9999,
  },
  tabListDesktopContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    padding: Spacing.three,
    zIndex: 9999,
  },
  innerContainer: {
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
  },
  innerMobileContainer: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    width: '100%',
    maxWidth: 600,
    justifyContent: 'space-around',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  innerDesktopContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonPressable: {
    justifyContent: 'center',
  },
  tabButtonMobilePressable: {
    flex: 1,
  },
  tabButtonView: {
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButtonMobileView: {
    flexDirection: 'column',
    paddingVertical: 6,
    paddingHorizontal: 4,
    width: '100%',
  },
  tabButtonDesktopView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  mobileIcon: {
    marginBottom: 2,
  },
  labelText: {
    fontWeight: 'bold',
  },
  externalPressable: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: Spacing.three,
  },
});
