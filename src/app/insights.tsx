import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDisplayClock } from '@/hooks/use-display-clock';
import { StorageService, type AppSettings, type FeedingLog } from '@/utils/storage';
import { summarizeFeedingWeek } from '@/utils/weekly-insights';

type InsightsSnapshot = { babyName: string; volumeUnit: AppSettings['volumeUnit']; logs: FeedingLog[] };

function formatInterval(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (!minutes) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

export default function InsightsScreen() {
  const { show } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const [snapshot, setSnapshot] = useState<InsightsSnapshot | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const now = useDisplayClock(60000);

  useFocusEffect(useCallback(() => {
    let current = true;
    setSnapshot(null);
    setLoadFailed(false);
    async function load() {
      try {
        const [settings, profiles] = await Promise.all([StorageService.getSettings(), StorageService.getProfiles()]);
        const baby = profiles.find(profile => profile.id === settings.activeBabyId) ?? profiles[0];
        const logs = await StorageService.getLogsForBaby(baby.id);
        if (current) setSnapshot({ babyName: baby.name, volumeUnit: settings.volumeUnit, logs });
      } catch {
        if (current) {
          setLoadFailed(true);
          show({ title: 'Could not load feeding insights' });
        }
      }
    }
    void load();
    return () => { current = false; };
  }, [show]));

  if (!snapshot) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.scrollContent}>
          <ThemedText>{loadFailed ? 'Reopen Insights to try again.' : 'Loading insights…'}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const week = summarizeFeedingWeek(snapshot.logs, now);
  const maxBottleMl = Math.max(1, ...week.days.map(day => day.bottleMl));
  const getVolumeDisplay = (ml: number) => snapshot.volumeUnit === 'oz'
    ? `${Number((ml * 0.033814).toFixed(1))} oz`
    : `${ml} ml`;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.headerTitle}>
              Nursery Insights
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Last 7 days for <ThemedText type="smallBold" style={{ color: colors.primary }}>{snapshot.babyName}</ThemedText>
            </ThemedText>
          </ThemedView>

          {/* KPI grid */}
          <View style={styles.kpiGrid}>
            {/* KPI 1 */}
            <ThemedView type="backgroundElement" style={styles.kpiCard}>
              <AppIcon name="baby" size={22} color={colors.breast} />
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Total nursing time</ThemedText>
              <ThemedText type="bold" style={styles.kpiValue}>
                {Math.round(week.nursingSeconds / 60)} <ThemedText type="small">min</ThemedText>
              </ThemedText>
            </ThemedView>

            {/* KPI 2 */}
            <ThemedView type="backgroundElement" style={styles.kpiCard}>
              <AppIcon name="milk" size={22} color={colors.bottle} />
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Total bottle volume</ThemedText>
              <ThemedText type="bold" style={styles.kpiValue}>
                {getVolumeDisplay(week.bottleMl)}
              </ThemedText>
            </ThemedView>
          </View>

          {/* Chart Section */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle" style={styles.cardTitle}>Daily bottle volume</ThemedText>
            {week.counts.bottle === 0 ? (
              <View style={styles.emptyChart}>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  No bottles recorded in the last 7 days.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.chartWrapper}>
                <View style={styles.barChartContainer}>
                  {week.days.map(day => (
                    <View key={day.key} style={styles.chartColumn}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${day.bottleMl / maxBottleMl * 100}%`,
                              backgroundColor: colors.bottle,
                            },
                          ]}
                        />
                      </View>
                      <ThemedText type="smallBold" style={styles.chartLabel}>
                        {day.label}
                      </ThemedText>
                      <ThemedText style={[styles.chartValText, { color: colors.textSecondary }]}>
                        {getVolumeDisplay(day.bottleMl)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ThemedView>

          {/* Counts Summary */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle" style={styles.cardTitle}>Weekly Activity Breakdown</ThemedText>
            
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <View style={[styles.bullet, { backgroundColor: colors.breast }]} />
                <ThemedText type="smallBold">Nursing Sessions</ThemedText>
                <ThemedText type="bold" style={{ marginLeft: 'auto' }}>
                  {week.counts.breast}
                </ThemedText>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.bullet, { backgroundColor: colors.bottle }]} />
                <ThemedText type="smallBold">Bottle Feedings</ThemedText>
                <ThemedText type="bold" style={{ marginLeft: 'auto' }}>
                  {week.counts.bottle}
                </ThemedText>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.bullet, { backgroundColor: colors.solid }]} />
                <ThemedText type="smallBold">Solid Feedings</ThemedText>
                <ThemedText type="bold" style={{ marginLeft: 'auto' }}>
                  {week.counts.solid}
                </ThemedText>
              </View>
            </View>
          </ThemedView>

          {week.averageIntervalMs !== null && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="subtitle" style={styles.cardTitle}>Average time between recorded feeds</ThemedText>
              <ThemedText type="bold" style={styles.kpiValue}>{formatInterval(week.averageIntervalMs)}</ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                {week.intervalCount} {week.intervalCount === 1 ? 'interval' : 'intervals'} in the last 7 days
              </ThemedText>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  kpiCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: 16,
    gap: Spacing.one,
  },
  kpiValue: {
    fontSize: 20,
    marginTop: Spacing.one,
  },
  card: {
    padding: Spacing.four,
    borderRadius: 20,
    gap: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyChart: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  chartWrapper: {
    marginTop: Spacing.two,
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    paddingTop: Spacing.three,
  },
  chartColumn: {
    alignItems: 'center',
    width: '13%',
  },
  barTrack: {
    width: 14,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  chartLabel: {
    fontSize: 10,
    marginTop: Spacing.one,
  },
  chartValText: {
    fontSize: 8,
    textAlign: 'center',
    marginTop: 2,
  },
  breakdownRow: {
    gap: Spacing.two,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  bullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
