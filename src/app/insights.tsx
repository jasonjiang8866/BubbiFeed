import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/toast';
import AppIcon from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { AppSettings, BabyProfile, FeedingLog, StorageService } from '@/utils/storage';
import { useColorScheme } from 'react-native';

interface DailyStat {
  dayLabel: string;
  breastCount: number;
  bottleVolume: number;
  solidCount: number;
}

export default function InsightsScreen() {
  const { show } = useToast();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const [activeBaby, setActiveBaby] = useState<BabyProfile | null>(null);
  const [logs, setLogs] = useState<FeedingLog[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Insights Stats States
  const [nursingAvgMinutes, setNursingAvgMinutes] = useState(0);
  const [bottleAvgVolume, setBottleAvgVolume] = useState(0);
  const [solidTotalCount, setSolidTotalCount] = useState(0);
  const [avgIntervalHours, setAvgIntervalHours] = useState(0);
  const [nextFeedForecast, setNextFeedForecast] = useState<string | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);

  useFocusEffect(
    useCallback(() => {
      void calculateInsights().catch(() => show({ title: 'Could not load feeding insights' }));
    }, [show])
  );

  const calculateInsights = async () => {
    const sets = await StorageService.getSettings();
    setSettings(sets);

    if (sets.activeBabyId) {
      const profiles = await StorageService.getProfiles();
      const active = profiles.find((p) => p.id === sets.activeBabyId);
      setActiveBaby(active || profiles[0]);

      const babyLogs = await StorageService.getLogsForBaby(sets.activeBabyId);
      setLogs(babyLogs);

      if (babyLogs.length === 0) {
        setNursingAvgMinutes(0);
        setBottleAvgVolume(0);
        setSolidTotalCount(0);
        setAvgIntervalHours(0);
        setNextFeedForecast(null);
        setDailyStats([]);
        return;
      }

      // 1. Averages
      let totalNursingSecs = 0;
      let nursingLogsCount = 0;
      let totalBottleVolume = 0;
      let bottleLogsCount = 0;
      let solidsCount = 0;

      babyLogs.forEach((log) => {
        if (log.type === 'breast' && log.details.breast) {
          totalNursingSecs += (log.details.breast.leftDuration + log.details.breast.rightDuration);
          nursingLogsCount++;
        } else if (log.type === 'bottle' && log.details.bottle) {
          totalBottleVolume += log.details.bottle.amount;
          bottleLogsCount++;
        } else if (log.type === 'solid') {
          solidsCount++;
        }
      });

      setNursingAvgMinutes(nursingLogsCount > 0 ? Math.round((totalNursingSecs / 60) / Math.max(1, Math.ceil(babyLogs.length / 5))) : 0);
      setBottleAvgVolume(bottleLogsCount > 0 ? Math.round(totalBottleVolume / Math.max(1, Math.ceil(babyLogs.length / 5))) : 0);
      setSolidTotalCount(solidsCount);

      // 2. Average Interval between feeds (in hours)
      const sortedLogsAsc = [...babyLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      let totalIntervalsMs = 0;
      let intervalCount = 0;

      for (let i = 1; i < sortedLogsAsc.length; i++) {
        const diff = new Date(sortedLogsAsc[i].timestamp).getTime() - new Date(sortedLogsAsc[i - 1].timestamp).getTime();
        // Ignore intervals larger than 12 hours (e.g. overnight gaps) to get better active estimates
        if (diff > 0 && diff < 12 * 60 * 60 * 1000) {
          totalIntervalsMs += diff;
          intervalCount++;
        }
      }

      const calculatedAvgIntervalHours = intervalCount > 0 ? (totalIntervalsMs / (1000 * 60 * 60)) / intervalCount : 3.0; // default 3 hours
      setAvgIntervalHours(calculatedAvgIntervalHours);

      // 3. Next Feed Forecast
      if (sortedLogsAsc.length > 0) {
        const lastFeed = sortedLogsAsc[sortedLogsAsc.length - 1];
        const lastFeedTime = new Date(lastFeed.timestamp).getTime();
        const nextEstimatedTime = new Date(lastFeedTime + calculatedAvgIntervalHours * 60 * 60 * 1000);
        
        const now = new Date();
        if (nextEstimatedTime.getTime() < now.getTime()) {
          setNextFeedForecast('Hungry Now');
        } else {
          setNextFeedForecast(nextEstimatedTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
        }
      } else {
        setNextFeedForecast(null);
      }

      // 4. Last 7 Days chart stats
      const statsMap: { [key: string]: DailyStat } = {};
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayKey = d.toDateString();
        const dayLabel = weekdays[d.getDay()];
        statsMap[dayKey] = { dayLabel, breastCount: 0, bottleVolume: 0, solidCount: 0 };
      }

      babyLogs.forEach((log) => {
        const logDateKey = new Date(log.timestamp).toDateString();
        if (statsMap[logDateKey]) {
          if (log.type === 'breast') statsMap[logDateKey].breastCount++;
          if (log.type === 'bottle' && log.details.bottle) statsMap[logDateKey].bottleVolume += log.details.bottle.amount;
          if (log.type === 'solid') statsMap[logDateKey].solidCount++;
        }
      });

      setDailyStats(Object.values(statsMap));
    }
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
          
          {/* Header */}
          <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.headerTitle}>
              Nursery Insights
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Smart forecasts and stats for <ThemedText type="smallBold" style={{ color: colors.primary }}>{activeBaby?.name || 'Nursery Baby'}</ThemedText>
            </ThemedText>
          </ThemedView>

          {/* Forecasting Card */}
          {nextFeedForecast && (
            <ThemedView type="backgroundSelected" style={[styles.forecastCard, { borderColor: colors.primary }]}>
              <View style={styles.forecastHeader}>
                <AppIcon name="clock" size={20} color={colors.primary} />
                <ThemedText type="bold" style={{ color: colors.primary }}>AI NURSING FORECAST</ThemedText>
              </View>
              <View style={styles.forecastBody}>
                <ThemedText type="title" style={styles.forecastTime}>{nextFeedForecast}</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Estimated next feeding window (based on average interval of {avgIntervalHours.toFixed(1)}h)
                </ThemedText>
              </View>
            </ThemedView>
          )}

          {/* KPI grid */}
          <View style={styles.kpiGrid}>
            {/* KPI 1 */}
            <ThemedView type="backgroundElement" style={styles.kpiCard}>
              <AppIcon name="baby" size={22} color={colors.breast} />
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Nursing Avg</ThemedText>
              <ThemedText type="bold" style={styles.kpiValue}>
                {nursingAvgMinutes} <ThemedText type="small">min/day</ThemedText>
              </ThemedText>
            </ThemedView>

            {/* KPI 2 */}
            <ThemedView type="backgroundElement" style={styles.kpiCard}>
              <AppIcon name="milk" size={22} color={colors.bottle} />
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Bottle Avg</ThemedText>
              <ThemedText type="bold" style={styles.kpiValue}>
                {getVolumeDisplay(bottleAvgVolume)}<ThemedText type="small">/day</ThemedText>
              </ThemedText>
            </ThemedView>
          </View>

          {/* Chart Section */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle" style={styles.cardTitle}>Daily Feeding Volumes (7 Days)</ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: -Spacing.one }}>
              Total bottle volumes logged per day
            </ThemedText>

            {dailyStats.length === 0 ? (
              <View style={styles.emptyChart}>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Log feeds to see weekly analytics charts.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.chartWrapper}>
                <View style={styles.barChartContainer}>
                  {dailyStats.map((stat, idx) => {
                    // Normalize bar height, max volume preset 300ml for scale
                    const maxPossibleVolume = Math.max(...dailyStats.map((s) => s.bottleVolume), 120);
                    const barHeightPercent = Math.max((stat.bottleVolume / maxPossibleVolume) * 100, 5); // min 5%
                    
                    return (
                      <View key={idx} style={styles.chartColumn}>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                height: `${barHeightPercent}%`,
                                backgroundColor: colors.bottle,
                              },
                            ]}
                          />
                        </View>
                        <ThemedText type="smallBold" style={styles.chartLabel}>
                          {stat.dayLabel}
                        </ThemedText>
                        <ThemedText style={[styles.chartValText, { color: colors.textSecondary }]}>
                          {stat.bottleVolume > 0 ? getVolumeDisplay(stat.bottleVolume) : '-'}
                        </ThemedText>
                      </View>
                    );
                  })}
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
                  {dailyStats.reduce((acc, curr) => acc + curr.breastCount, 0)}
                </ThemedText>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.bullet, { backgroundColor: colors.bottle }]} />
                <ThemedText type="smallBold">Bottle Feedings</ThemedText>
                <ThemedText type="bold" style={{ marginLeft: 'auto' }}>
                  {logs.filter((l) => l.type === 'bottle').length}
                </ThemedText>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.bullet, { backgroundColor: colors.solid }]} />
                <ThemedText type="smallBold">Solid Feedings</ThemedText>
                <ThemedText type="bold" style={{ marginLeft: 'auto' }}>
                  {solidTotalCount}
                </ThemedText>
              </View>
            </View>
          </ThemedView>

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
  forecastCard: {
    padding: Spacing.four,
    borderRadius: 20,
    borderWidth: 2,
    gap: Spacing.two,
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  forecastBody: {
    gap: Spacing.one,
  },
  forecastTime: {
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
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
