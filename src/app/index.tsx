import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  View,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useRouter, useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, Colors } from '@/constants/theme';
import { StorageService, FeedingLog, AppSettings, BabyProfile } from '@/utils/storage';
import { useColorScheme } from 'react-native';
import { Confetti, ConfettiRef } from '@/components/confetti';

export default function HomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const [activeBaby, setActiveBaby] = useState<BabyProfile | null>(null);
  const confettiRef = useRef<ConfettiRef>(null);
  const [profiles, setProfiles] = useState<BabyProfile[]>([]);
  const [logs, setLogs] = useState<FeedingLog[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Home stats
  const [timeSinceLastFeed, setTimeSinceLastFeed] = useState<string>('No feeds logged');
  const [lastFeedObj, setLastFeedObj] = useState<FeedingLog | null>(null);
  const [todayNursingMins, setTodayNursingMins] = useState(0);
  const [todayBottleMl, setTodayBottleMl] = useState(0);
  const [todaySolidsCount, setTodaySolidsCount] = useState(0);
  
  // Dynamic tick for "time since last feed"
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastFeedObj) {
        updateTimeSince(lastFeedObj.timestamp);
      }
    }, 60000); // every minute

    return () => clearInterval(timer);
  }, [lastFeedObj]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    const sets = await StorageService.getSettings();
    const profs = await StorageService.getProfiles();
    setSettings(sets);
    setProfiles(profs);

    let active = profs.find((p) => p.id === sets.activeBabyId);
    if (!active && profs.length > 0) {
      active = profs[0];
    }
    setActiveBaby(active || null);

    if (active) {
      const babyLogs = await StorageService.getLogsForBaby(active.id);
      setLogs(babyLogs);

      // Calculations
      if (babyLogs.length > 0) {
        const last = babyLogs[0]; // first item is newest in sorted
        setLastFeedObj(last);
        updateTimeSince(last.timestamp);
      } else {
        setLastFeedObj(null);
        setTimeSinceLastFeed('No feeds logged');
      }

      // Today's stats
      const todayString = new Date().toDateString();
      let nursingSecs = 0;
      let bottleMl = 0;
      let solids = 0;

      babyLogs.forEach((log) => {
        if (new Date(log.timestamp).toDateString() === todayString) {
          if (log.type === 'breast' && log.details.breast) {
            nursingSecs += (log.details.breast.leftDuration + log.details.breast.rightDuration);
          } else if (log.type === 'bottle' && log.details.bottle) {
            bottleMl += log.details.bottle.amount;
          } else if (log.type === 'solid') {
            solids++;
          }
        }
      });

      setTodayNursingMins(Math.round(nursingSecs / 60));
      setTodayBottleMl(bottleMl);
      setTodaySolidsCount(solids);
    }
  };

  const updateTimeSince = (isoString: string) => {
    const lastTime = new Date(isoString).getTime();
    const now = new Date().getTime();
    const diffMs = now - lastTime;

    if (diffMs < 0) {
      setTimeSinceLastFeed('Just logged');
      return;
    }

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours === 0) {
      setTimeSinceLastFeed(`${mins}m ago`);
    } else {
      setTimeSinceLastFeed(`${hours}h ${mins}m ago`);
    }
  };

  // Switch baby from dashboard header
  const handleSwitchBaby = async (baby: BabyProfile) => {
    if (!settings) return;
    const newSettings = { ...settings, activeBabyId: baby.id };
    await StorageService.saveSettings(newSettings);
    setSettings(newSettings);
    setActiveBaby(baby);
    // Reload
    const babyLogs = await StorageService.getLogsForBaby(baby.id);
    setLogs(babyLogs);
    if (babyLogs.length > 0) {
      const last = babyLogs[0];
      setLastFeedObj(last);
      updateTimeSince(last.timestamp);
    } else {
      setLastFeedObj(null);
      setTimeSinceLastFeed('No feeds logged');
    }
  };

  // Calculate baby age dynamically
  const getBabyAge = () => {
    if (!activeBaby) return '';
    const birth = new Date(activeBaby.birthDate).getTime();
    const now = new Date().getTime();
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
      id: `log-${Date.now()}`,
      babyId: activeBaby.id,
      type: 'bottle',
      timestamp: new Date().toISOString(),
      notes: 'Logged with 3 AM Speedy Preset ⚡',
      details: {
        bottle: {
          amount: amountMl,
          bottleType: 'formula',
        },
      },
    };
    await StorageService.saveLog(newLog);
    confettiRef.current?.trigger();
    setTimeout(() => {
      Alert.alert('Logged!', `Speedy bottle of ${getVolumeDisplay(amountMl)} recorded.`);
      loadDashboardData();
    }, 200);
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
                <ThemedText style={{ fontSize: 24 }}>
                  {activeBaby?.gender === 'boy' ? '👶' : activeBaby?.gender === 'girl' ? '👧' : '🍼'}
                </ThemedText>
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

          {/* Time Since Last Feeding (Big Dial Card) */}
          <ThemedView type="backgroundElement" style={styles.mainDialCard}>
            <ThemedText type="smallBold" style={{ color: colors.textSecondary, textTransform: 'uppercase' }}>
              Time Since Last Feed
            </ThemedText>
            <ThemedText style={[styles.dialCounter, { color: colors.primary }]}>{timeSinceLastFeed}</ThemedText>
            {lastFeedObj && (
              <View style={styles.lastFeedSubDetails}>
                <ThemedText style={{ fontSize: 12 }}>
                  {lastFeedObj.type === 'breast' ? '👩‍🍼' : lastFeedObj.type === 'bottle' ? '🍼' : '🥑'}
                </ThemedText>
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
                <ThemedText style={{ fontSize: 22 }}>👩‍🍼</ThemedText>
                <ThemedText type="bold">{todayNursingMins}m</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>Nursing</ThemedText>
              </View>
              <View style={styles.totalItem}>
                <ThemedText style={{ fontSize: 22 }}>🍼</ThemedText>
                <ThemedText type="bold">{getVolumeDisplay(todayBottleMl)}</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>Bottle</ThemedText>
              </View>
              <View style={styles.totalItem}>
                <ThemedText style={{ fontSize: 22 }}>🥑</ThemedText>
                <ThemedText type="bold">{todaySolidsCount}</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>Solids</ThemedText>
              </View>
            </View>
          </ThemedView>

          {/* 3 AM Fast Bottle Logger */}
          <ThemedView type="backgroundElement" style={styles.presetsCard}>
            <View style={styles.presetTitleRow}>
              <ThemedText style={{ fontSize: 14 }}>⚡</ThemedText>
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
              <ThemedText style={{ fontSize: 22 }}>✍️</ThemedText>
              <ThemedText type="smallBold" style={{ color: colors.primary }}>Log Manual Feed</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => router.push('/history')}
              style={({ pressed }) => [
                styles.shortcutCard,
                { backgroundColor: colors.bottle + '20', transform: [{ scale: pressed ? 0.95 : 1 }] },
              ]}
            >
              <ThemedText style={{ fontSize: 18 }}>📅</ThemedText>
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
                  const labelColor = log.type === 'breast' ? colors.breast : log.type === 'bottle' ? colors.bottle : colors.solid;
                  const logIcon = log.type === 'breast' ? '👩‍🍼' : log.type === 'bottle' ? '🍼' : '🥑';
                  
                  return (
                    <View key={log.id} style={styles.recentItem}>
                      <View style={[styles.recentIconBadge, { backgroundColor: labelColor + '20' }]}>
                        <ThemedText style={{ fontSize: 16 }}>{logIcon}</ThemedText>
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
    fontSize: 40,
    fontWeight: 'bold',
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
