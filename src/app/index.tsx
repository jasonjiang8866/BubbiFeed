import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppIcon from '@/components/app-icon';
import { Confetti, ConfettiRef } from '@/components/confetti';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { FEED_TYPE_COLOR, FEED_TYPE_ICON } from '@/constants/feed-icons';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatNursingTime, useDisplayClock } from '@/hooks/use-display-clock';
import { NursingSession, nursingDurations, ActiveBabyChangedError, AppSettings, BabyProfile, FeedingLog, localCalendarDate, newLogId, StorageService } from '@/utils/storage';
import { useColorScheme } from 'react-native';

function formatTimeSince(timestamp: string, now: number) {
  const minutes = Math.floor((now - Date.parse(timestamp)) / 60000);
  if (minutes < 0) return 'Just logged';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

export default function HomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const confettiRef = useRef<ConfettiRef>(null);
  const savingFeed = useRef(false);
  const request = useRef(0);
  const { show } = useToast();
  const [dashboard, setDashboard] = useState<{
    activeBaby: BabyProfile;
    profiles: BabyProfile[];
    settings: AppSettings;
    logs: FeedingLog[];
    session: NursingSession | null;
  } | null>(null);
  const session = dashboard?.session ?? null;
  const running = session !== null && session.runningSince !== null;
  const now = useDisplayClock(running ? 1000 : 60000);
  const nursing = nursingDurations(session, now);
  const activeBaby = dashboard?.activeBaby;
  const profiles = dashboard?.profiles ?? [];
  const settings = dashboard?.settings;
  const logs = dashboard?.logs ?? [];
  const lastFeedObj = logs[0];
  const today = new Date(now).toDateString();
  let todayNursingSeconds = 0;
  let todayBottleMl = 0;
  let todaySolidsCount = 0;
  for (const log of logs) {
    if (new Date(log.timestamp).toDateString() !== today) continue;
    if (log.type === 'breast' && log.details.breast) {
      todayNursingSeconds += log.details.breast.leftDuration + log.details.breast.rightDuration;
    } else if (log.type === 'bottle') {
      todayBottleMl += log.details.bottle?.amount ?? 0;
    } else if (log.type === 'solid') {
      todaySolidsCount++;
    }
  }
  const todayNursingMins = Math.round(todayNursingSeconds / 60);
  const timeSinceLastFeed = lastFeedObj ? formatTimeSince(lastFeedObj.timestamp, now) : 'No feeds logged';

  const loadDashboardData = useCallback(async () => {
    const current = ++request.current;
    try {
      const [settings, profiles] = await Promise.all([StorageService.getSettings(), StorageService.getProfiles()]);
      const activeBaby = profiles.find(p => p.id === settings.activeBabyId) ?? profiles[0];
      const [logs, session] = await Promise.all([
        StorageService.getLogsForBaby(activeBaby.id),
        StorageService.getNursingSession(activeBaby.id),
      ]);
      if (request.current !== current) return;
      setDashboard({ settings, profiles, activeBaby, logs, session });
    } catch {
      if (request.current !== current) return;
      setDashboard(null);
      show({ title: 'Could not load feeding history', description: 'Reopen Home to retry.' });
    }
  }, [show]);

  useFocusEffect(useCallback(() => {
    void loadDashboardData();
    return () => { request.current++; };
  }, [loadDashboardData]));

  const handleSwitchBaby = async (baby: BabyProfile) => {
    try {
      await StorageService.saveSettings({ activeBabyId: baby.id });
    } catch {
      show({ title: 'Could not switch baby', description: 'Please try again.' });
      return;
    }
    await loadDashboardData();
  };

  // Calculate baby age dynamically
  const getBabyAge = () => {
    if (!activeBaby) return '';
    const birth = Date.parse(activeBaby.birthDate.split('T')[0]);
    const now = Date.parse(localCalendarDate());
    const diffMs = now - birth;

    if (diffMs < 0) return 'Expected soon';

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) {
      return `${diffDays} days old`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} old`;
    } else {
      const months = Math.floor(diffDays / 30.4);
      const remainingDays = Math.floor(diffDays % 30.4);
      if (months === 0) return `${diffDays} days old`;
      return `${months} ${months === 1 ? 'month' : 'months'} old`;
    }
  };

  // 3 AM Speedy Preset Bottle Logger
  const handleSpeedyBottleLog = async (amountMl: number) => {
    if (!activeBaby) {
      Alert.alert('Required', 'Please add a baby profile in Settings first.');
      return;
    }
    const newLog: FeedingLog = {
      id: newLogId(),
      babyId: activeBaby.id,
      type: 'bottle',
      timestamp: new Date().toISOString(),
      notes: 'Logged with 3 AM Speedy Preset',
      details: {
        bottle: {
          amount: amountMl,
          bottleType: 'formula',
        },
      },
    };
    if (savingFeed.current) return;
    savingFeed.current = true;
    try {
      await StorageService.saveLog(newLog, { requireActiveBaby: true });
    } catch (error) {
      show({
        title: 'Feeding not saved',
        description: error instanceof ActiveBabyChangedError
          ? 'Reopen Home to refresh the active baby.'
          : 'Please try again.',
      });
      return;
    } finally {
      savingFeed.current = false;
    }
    confettiRef.current?.trigger();
    show({
      title: 'Feeding logged',
      description: `Speedy bottle of ${getVolumeDisplay(amountMl)} recorded.`,
      icon: 'milk',
      tone: 'bottle',
    });
    loadDashboardData();
  };

  const isOz = settings?.volumeUnit === 'oz';
  const getVolumeDisplay = (ml: number) => {
    if (isOz) {
      return `${(ml * 0.033814).toFixed(0)} oz`;
    }
    return `${ml} ml`;
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Dashboard Switcher Header */}
          <View style={styles.header}>
            <View style={styles.babyProfileSection}>
              <View
                style={[
                  styles.profileAvatar,
                  {
                    backgroundColor:
                      activeBaby?.gender === 'boy'
                        ? colors.bottle + '30'
                        : activeBaby?.gender === 'girl'
                        ? colors.breast + '30'
                        : colors.solid + '30',
                  },
                ]}
              >
                <AppIcon
                  name="baby"
                  size={28}
                  color={
                    activeBaby?.gender === 'boy'
                      ? colors.bottle
                      : activeBaby?.gender === 'girl'
                      ? colors.breast
                      : colors.solid
                  }
                />
              </View>
              <View>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>Welcome back!</ThemedText>
                <ThemedText type="bold" style={styles.babyName}>
                  {activeBaby?.name || 'My Little Baby'}
                </ThemedText>
                <ThemedText type="small" style={{ color: colors.primary, fontWeight: 'bold' }}>
                  {getBabyAge()}
                </ThemedText>
              </View>
            </View>
            
            {/* Rapid Baby Switch Buttons */}
            {profiles.length > 1 && (
              <View style={styles.siblingRow}>
                {profiles.map((baby) => {
                  if (baby.id === activeBaby?.id) return null;
                  return (
                    <Pressable
                      key={baby.id}
                      onPress={() => handleSwitchBaby(baby)}
                      style={({ pressed }) => [
                        styles.siblingBadge,
                        { backgroundColor: colors.backgroundSelected, transform: [{ scale: pressed ? 0.95 : 1 }] },
                      ]}
                    >
                      <ThemedText type="smallBold" style={{ color: colors.textSecondary }}>
                        Switch to {baby.name.split(' ')[0]}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {session && activeBaby && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Continue nursing for ${activeBaby.name}`}
              onPress={() => router.navigate({ pathname: '/logger', params: { resumeBaby: activeBaby.id, openTimer: newLogId() } })}
              style={({ pressed }) => [
                styles.continueCard,
                { backgroundColor: colors.backgroundElement, borderColor: colors.breast, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <AppIcon name={running ? 'timer' : 'pause'} size={24} color={colors.breast} />
              <View style={{ flex: 1 }}>
                <ThemedText type="bold">Continue nursing</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  {running ? 'Running' : 'Paused'} · {session.side === 'left' ? 'Left' : 'Right'} side · {formatNursingTime(nursing.leftDuration + nursing.rightDuration)}
                </ThemedText>
              </View>
              <AppIcon name="chevronRight" size={20} color={colors.textSecondary} />
            </Pressable>
          )}

          {/* Time Since Last Feeding (Big Dial Card) */}
          <ThemedView type="backgroundElement" style={styles.mainDialCard}>
            <ThemedText type="smallBold" style={{ color: colors.textSecondary, textTransform: 'uppercase' }}>
              Time Since Last Feed
            </ThemedText>
            <ThemedText style={[styles.dialCounter, { color: colors.primary }]}>{timeSinceLastFeed}</ThemedText>
            {lastFeedObj && (
              <View style={styles.lastFeedSubDetails}>
                <AppIcon
                  name={FEED_TYPE_ICON[lastFeedObj.type]}
                  size={14}
                  color={colors[FEED_TYPE_COLOR[lastFeedObj.type]]}
                />
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Last Session: {lastFeedObj.type.toUpperCase()} at {new Date(lastFeedObj.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
              </View>
            )}
          </ThemedView>

          {/* Today's Daily Totals Card */}
          <ThemedView type="backgroundElement" style={styles.totalsCard}>
            <ThemedText type="subtitle" style={styles.cardTitle}>Today's Nursing Scorecard</ThemedText>
            <View style={styles.totalsGrid}>
              <View style={styles.totalItem}>
                <AppIcon name="baby" size={22} color={colors.breast} />
                <ThemedText type="bold">{todayNursingMins}m</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>Nursing</ThemedText>
              </View>
              <View style={styles.totalItem}>
                <AppIcon name="milk" size={22} color={colors.bottle} />
                <ThemedText type="bold">{getVolumeDisplay(todayBottleMl)}</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>Bottle</ThemedText>
              </View>
              <View style={styles.totalItem}>
                <AppIcon name="apple" size={22} color={colors.solid} />
                <ThemedText type="bold">{todaySolidsCount}</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>Solids</ThemedText>
              </View>
            </View>
          </ThemedView>

          {/* 3 AM Fast Bottle Logger */}
          <ThemedView type="backgroundElement" style={styles.presetsCard}>
            <View style={styles.presetTitleRow}>
              <AppIcon name="zap" size={14} color={colors.primary} />
              <ThemedText type="smallBold">3 AM Speedy Presets</ThemedText>
            </View>
            <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: -Spacing.one }}>
              Instantly log a default formula bottle with one-tap
            </ThemedText>
            <View style={styles.presetButtonsRow}>
              <Pressable
                onPress={() => handleSpeedyBottleLog(90)}
                style={({ pressed }) => [
                  styles.presetBtn,
                  { backgroundColor: colors.bottle, transform: [{ scale: pressed ? 0.94 : 1 }] },
                ]}
              >
                <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>{getVolumeDisplay(90)}</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => handleSpeedyBottleLog(120)}
                style={({ pressed }) => [
                  styles.presetBtn,
                  { backgroundColor: colors.bottle, transform: [{ scale: pressed ? 0.94 : 1 }] },
                ]}
              >
                <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>{getVolumeDisplay(120)}</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => handleSpeedyBottleLog(150)}
                style={({ pressed }) => [
                  styles.presetBtn,
                  { backgroundColor: colors.bottle, transform: [{ scale: pressed ? 0.94 : 1 }] },
                ]}
              >
                <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>{getVolumeDisplay(150)}</ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          {/* Quick Action Navigator Shortcuts */}
          <View style={styles.shortcutRow}>
            <Pressable
              onPress={() => router.push('/logger')}
              style={({ pressed }) => [
                styles.shortcutCard,
                { backgroundColor: colors.primary + '20', transform: [{ scale: pressed ? 0.95 : 1 }] },
              ]}
            >
              <AppIcon name="penLine" size={22} color={colors.primary} />
              <ThemedText type="smallBold" style={{ color: colors.primary }}>Log Manual Feed</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => router.push('/history')}
              style={({ pressed }) => [
                styles.shortcutCard,
                { backgroundColor: colors.bottle + '20', transform: [{ scale: pressed ? 0.95 : 1 }] },
              ]}
            >
              <AppIcon name="history" size={20} color={colors.bottle} />
              <ThemedText type="smallBold" style={{ color: colors.bottle }}>View Ledger</ThemedText>
            </Pressable>
          </View>

          {/* Recent Activity List */}
          <ThemedView type="backgroundElement" style={styles.totalsCard}>
            <ThemedText type="subtitle" style={styles.cardTitle}>Recent Activity</ThemedText>
            
            {logs.length === 0 ? (
              <ThemedText type="small" style={{ color: colors.textSecondary, textAlign: 'center', padding: Spacing.two }}>
                No feeding events logged. Tap 'Log Manual Feed' to get started!
              </ThemedText>
            ) : (
              <View style={styles.recentList}>
                {logs.slice(0, 3).map((log) => {
                  const labelColor = colors[FEED_TYPE_COLOR[log.type]];

                  return (
                    <View key={log.id} style={styles.recentItem}>
                      <View style={[styles.recentIconBadge, { backgroundColor: labelColor + '20' }]}>
                        <AppIcon name={FEED_TYPE_ICON[log.type]} size={16} color={labelColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="bold" style={{ textTransform: 'capitalize' }}>
                          {log.type} Feeding
                        </ThemedText>
                        <ThemedText type="small" style={{ color: colors.textSecondary }}>
                          {new Date(log.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {log.notes || 'No notes'}
                        </ThemedText>
                      </View>
                      <View style={styles.recentDetailsBadge}>
                        <ThemedText type="smallBold" style={{ color: labelColor }}>
                          {log.type === 'bottle'
                            ? getVolumeDisplay(log.details.bottle?.amount || 0)
                            : log.type === 'breast'
                            ? `${Math.round(((log.details.breast?.leftDuration || 0) + (log.details.breast?.rightDuration || 0)) / 60)}m`
                            : 'Solid'}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ThemedView>

        </ScrollView>
      </SafeAreaView>
      <Confetti ref={confettiRef} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginVertical: Spacing.three,
    gap: Spacing.two,
  },
  babyProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  babyName: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  siblingRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  siblingBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 12,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.four,
  },
  mainDialCard: {
    padding: Spacing.five,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  dialCounter: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  lastFeedSubDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  totalsCard: {
    padding: Spacing.four,
    borderRadius: 20,
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  totalItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  presetsCard: {
    padding: Spacing.four,
    borderRadius: 20,
    gap: Spacing.two,
  },
  presetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  shortcutCard: {
    flex: 1,
    padding: Spacing.four,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  recentList: {
    gap: Spacing.three,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    paddingBottom: Spacing.two,
  },
  recentIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentDetailsBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
});
