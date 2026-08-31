import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  View,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, Colors } from '@/constants/theme';
import { StorageService, FeedingLog, AppSettings, BabyProfile } from '@/utils/storage';
import { useColorScheme } from 'react-native';

export default function HistoryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const [logs, setLogs] = useState<FeedingLog[]>([]);
  const [activeBaby, setActiveBaby] = useState<BabyProfile | null>(null);
  const [filter, setFilter] = useState<'all' | 'breast' | 'bottle' | 'solid'>('all');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);

  // Load history whenever tab is focused
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [filter])
  );

  const loadHistory = async () => {
    const sets = await StorageService.getSettings();
    setSettings(sets);
    
    if (sets.activeBabyId) {
      const profiles = await StorageService.getProfiles();
      const active = profiles.find((p) => p.id === sets.activeBabyId);
      setActiveBaby(active || profiles[0]);

      let babyLogs = await StorageService.getLogsForBaby(sets.activeBabyId);
      if (filter !== 'all') {
        babyLogs = babyLogs.filter((log) => log.type === filter);
      }
      setLogs(babyLogs);
    }
  };

  const handleDeleteLog = (logId: string) => {
    setDeleteLogId(logId);
  };

  const confirmDeleteLog = async () => {
    if (deleteLogId) {
      await StorageService.deleteLog(deleteLogId);
      setDeleteLogId(null);
      loadHistory();
    }
  };

  const getLogTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLogDateGroup = (isoString: string) => {
    const d = new Date(isoString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // Group logs by day
  const groupLogsByDate = () => {
    const groups: { [key: string]: FeedingLog[] } = {};
    logs.forEach((log) => {
      const dateKey = getLogDateGroup(log.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });
    return groups;
  };

  const groupedLogs = groupLogsByDate();

  // Helper formats
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins === 0) return `${seconds}s`;
    return `${mins}m ${seconds % 60}s`;
  };

  const isOz = settings?.volumeUnit === 'oz';
  const getVolumeDisplay = (ml: number) => {
    if (isOz) {
      return `${(ml * 0.033814).toFixed(1)} oz`;
    }
    return `${ml} ml`;
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>
            History Feed
          </ThemedText>
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            Timeline tracker for <ThemedText type="smallBold" style={{ color: colors.primary }}>{activeBaby?.name || 'Nursery Baby'}</ThemedText>
          </ThemedText>
        </View>

        {/* Filter Row */}
        <View style={styles.filterRow}>
          {(['all', 'breast', 'bottle', 'solid'] as const).map((type) => {
            const active = filter === type;
            const bColor = type === 'breast' ? colors.breast : type === 'bottle' ? colors.bottle : type === 'solid' ? colors.solid : colors.primary;
            return (
              <Pressable
                key={type}
                onPress={() => setFilter(type)}
                style={({ pressed }) => [
                  styles.filterBtn,
                  {
                    backgroundColor: active ? bColor : colors.backgroundElement,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                <ThemedText
                  type="smallBold"
                  style={{ color: active ? '#FFFFFF' : colors.textSecondary }}
                >
                  {type.toUpperCase()}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {Object.keys(groupedLogs).length === 0 ? (
            <View style={styles.emptyView}>
              <ThemedText style={styles.emptyEmoji}>🍽️</ThemedText>
              <ThemedText type="bold" style={{ textAlign: 'center' }}>No feedings recorded yet</ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary, textAlign: 'center' }}>
                Tap the "Log Feed" tab to add your first baby feeding details!
              </ThemedText>
            </View>
          ) : (
            Object.keys(groupedLogs).map((dateKey) => (
              <View key={dateKey} style={styles.dateGroup}>
                <View style={styles.dateHeaderRow}>
                  <ThemedText type="bold" style={[styles.dateGroupHeader, { color: colors.textSecondary }]}>
                    {dateKey}
                  </ThemedText>
                  <View style={[styles.dateLine, { backgroundColor: colors.cardBorder }]} />
                </View>

                <View style={styles.logsList}>
                  {groupedLogs[dateKey].map((log, index) => {
                    const themeColor =
                      log.type === 'breast'
                        ? colors.breast
                        : log.type === 'bottle'
                        ? colors.bottle
                        : colors.solid;

                    const iconEmoji =
                      log.type === 'breast' ? '👩‍🍼' : log.type === 'bottle' ? '🍼' : '🥑';

                    return (
                      <View key={log.id} style={styles.logWrapper}>
                        {/* Vertical Timeline Bar */}
                        <View style={styles.timelineColumn}>
                          <View style={[styles.timelineNode, { backgroundColor: themeColor }]} />
                          {index < groupedLogs[dateKey].length - 1 && (
                            <View style={[styles.timelineLine, { backgroundColor: colors.cardBorder }]} />
                          )}
                        </View>

                        {/* Timeline Card */}
                        <ThemedView type="backgroundElement" style={styles.logCard}>
                          <View style={styles.cardHeader}>
                            <View style={styles.typeBadgeRow}>
                              <ThemedText style={{ fontSize: 16 }}>{iconEmoji}</ThemedText>
                              <ThemedText type="bold" style={{ textTransform: 'capitalize' }}>
                                {log.type} Feed
                              </ThemedText>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                                {getLogTime(log.timestamp)}
                              </ThemedText>
                              <Pressable
                                onPress={() => handleDeleteLog(log.id)}
                                style={({ pressed }) => [
                                  styles.deleteBtn,
                                  { transform: [{ scale: pressed ? 0.88 : 1 }] }
                                ]}
                              >
                                <ThemedText style={{ fontSize: 14 }}>🗑️</ThemedText>
                              </Pressable>
                            </View>
                          </View>

                          {/* Card Content Details */}
                          <View style={styles.cardContent}>
                            {log.type === 'breast' && log.details.breast && (
                              <View style={styles.detailsRow}>
                                <View style={[styles.subBadge, { backgroundColor: colors.breast + '20' }]}>
                                  <ThemedText type="smallBold" style={{ color: colors.breast }}>
                                    L: {formatDuration(log.details.breast.leftDuration)}
                                  </ThemedText>
                                </View>
                                <View style={[styles.subBadge, { backgroundColor: colors.breast + '20' }]}>
                                  <ThemedText type="smallBold" style={{ color: colors.breast }}>
                                    R: {formatDuration(log.details.breast.rightDuration)}
                                  </ThemedText>
                                </View>
                              </View>
                            )}

                            {log.type === 'bottle' && log.details.bottle && (
                              <View style={styles.detailsRow}>
                                <View style={[styles.subBadge, { backgroundColor: colors.bottle + '20' }]}>
                                  <ThemedText type="smallBold" style={{ color: colors.bottle }}>
                                    {getVolumeDisplay(log.details.bottle.amount)}
                                  </ThemedText>
                                </View>
                                <View style={[styles.subBadge, { backgroundColor: colors.bottle + '20' }]}>
                                  <ThemedText type="smallBold" style={{ color: colors.bottle, textTransform: 'uppercase' }}>
                                    {log.details.bottle.bottleType === 'breastmilk' ? 'Breast Milk' : 'Formula'}
                                  </ThemedText>
                                </View>
                              </View>
                            )}

                            {log.type === 'solid' && log.details.solid && (
                              <View style={styles.detailsRow}>
                                <View style={[styles.subBadge, { backgroundColor: colors.solid + '20' }]}>
                                  <ThemedText type="smallBold" style={{ color: colors.solid === '#FFD97D' ? '#6B4E00' : colors.solid }}>
                                    {log.details.solid.foodDescription}
                                  </ThemedText>
                                </View>
                                <View style={[styles.subBadge, { backgroundColor: colors.solid + '20' }]}>
                                  <ThemedText type="smallBold" style={{ color: colors.solid === '#FFD97D' ? '#6B4E00' : colors.solid, textTransform: 'capitalize' }}>
                                    {log.details.solid.amountCategory.replace('_', ' ')}
                                  </ThemedText>
                                </View>
                              </View>
                            )}

                            {log.notes && (
                              <ThemedText type="small" style={[styles.notesText, { color: colors.textSecondary }]}>
                                "{log.notes}"
                              </ThemedText>
                            )}
                          </View>
                        </ThemedView>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Custom themed baby dialog popups */}
      <Modal
        visible={deleteLogId !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteLogId(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDeleteLogId(null)} />
          
          <ThemedView type="backgroundElement" style={[styles.modalCard, { borderColor: colors.backgroundSelected }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: colors.breast + '20' }]}>
              <ThemedText style={{ fontSize: 24 }}>🗑️</ThemedText>
            </View>

            <ThemedText type="bold" style={styles.modalTitle}>
              Delete Record?
            </ThemedText>

            <ThemedText type="small" style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to delete this feeding record? This action cannot be undone.
            </ThemedText>

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setDeleteLogId(null)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalCancelBtn,
                  {
                    backgroundColor: colors.backgroundSelected,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                <ThemedText type="smallBold" style={{ color: colors.textSecondary }}>
                  Cancel
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={confirmDeleteLog}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.breast,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
                  Delete
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
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
  header: {
    paddingHorizontal: Spacing.four,
    marginVertical: Spacing.two,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  emptyView: {
    padding: Spacing.six,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.six,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.two,
  },
  dateGroup: {
    marginBottom: Spacing.four,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  dateGroupHeader: {
    fontSize: 14,
  },
  dateLine: {
    flex: 1,
    height: 1,
    opacity: 0.1,
  },
  logsList: {
    gap: Spacing.two,
  },
  logWrapper: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  timelineColumn: {
    alignItems: 'center',
    width: 16,
  },
  timelineNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 18,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    opacity: 0.2,
  },
  logCard: {
    flex: 1,
    borderRadius: 16,
    padding: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    paddingBottom: Spacing.one,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  deleteBtn: {
    padding: Spacing.one,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  subBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 8,
  },
  notesText: {
    fontStyle: 'italic',
    marginTop: Spacing.one,
    paddingLeft: Spacing.one,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '90%',
    maxWidth: 340,
    borderRadius: 24,
    padding: Spacing.five,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  modalMessage: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.four,
    paddingHorizontal: Spacing.one,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    borderWidth: 0,
  },
});
