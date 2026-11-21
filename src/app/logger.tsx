import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
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
import { NursingSession, NursingSessionChangedError, NursingSide, nursingDurations, ActiveBabyChangedError, AppSettings, BabyProfile, FeedingLog, FeedingType, newLogId, StorageService } from '@/utils/storage';
import { useColorScheme } from 'react-native';

export default function LoggerScreen() {
  const [selection, setSelection] = useState<{ baby: BabyProfile; settings: AppSettings } | null>(null);
  const { show } = useToast();
  useFocusEffect(useCallback(() => {
    let current = true;
    async function refresh() {
      try {
        const [settings, profiles] = await Promise.all([StorageService.getSettings(), StorageService.getProfiles()]);
        const baby = profiles.find(p => p.id === settings.activeBabyId) ?? profiles[0];
        if (current) setSelection({ baby, settings });
      } catch {
        if (!current) return;
        setSelection(null);
        show({ title: 'Could not load baby profile', description: 'Reopen Log Feed to retry.' });
      }
    }
    void refresh();
    return () => { current = false; };
  }, [show]));

  if (!selection) return <SafeAreaView><ThemedText>Waiting for baby profile…</ThemedText></SafeAreaView>;
  return <FeedingForm key={selection.baby.id} activeBaby={selection.baby} settings={selection.settings} />;
}

function FeedingForm({ activeBaby, settings }: { activeBaby: BabyProfile; settings: AppSettings }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const [activeTab, setActiveTab] = useState<FeedingType>('breast');
  const savingFeed = useRef(false);
  const confettiRef = useRef<ConfettiRef>(null);
  const { show } = useToast();

  // Common Form States
  const [notes, setNotes] = useState('');
  
  // Custom Feeding Time clock states
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [selectedHour, setSelectedHour] = useState(new Date().getHours() % 12 || 12);
  const [selectedMinute, setSelectedMinute] = useState(new Date().getMinutes());
  const [selectedAmPm, setSelectedAmPm] = useState(new Date().getHours() >= 12 ? 'PM' : 'AM');
  const [hasCustomTime, setHasCustomTime] = useState(false);

  const hoursArray = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutesArray = Array.from({ length: 60 }, (_, i) => i);
  const ampmArray = ['AM', 'PM'];

  const formatSelectedTime = () => {
    if (!hasCustomTime) return 'Current Time';
    const hr = selectedHour.toString().padStart(2, '0');
    const min = selectedMinute.toString().padStart(2, '0');
    return `${hr}:${min} ${selectedAmPm}`;
  };

  // 1. Breast Nursing States
  const [session, setSession] = useState<NursingSession | null>(null);
  const [timerReady, setTimerReady] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [breastMode, setBreastMode] = useState<'timer' | 'manual'>('timer');
  const [manualSide, setManualSide] = useState<NursingSide | null>(null);
  const [leftManualMins, setLeftManualMins] = useState('');
  const [rightManualMins, setRightManualMins] = useState('');
  const timerActive = session && session.runningSince !== null ? session.side : null;
  const now = useDisplayClock(timerActive ? 1000 : null);
  const { leftDuration: leftSeconds, rightDuration: rightSeconds, lastBreastUsed } = nursingDurations(session, now);
  const { resumeBaby, openTimer } = useLocalSearchParams<{ resumeBaby?: string; openTimer?: string }>();

  const [handledOpen, setHandledOpen] = useState<string>();
  if (openTimer && resumeBaby === activeBaby.id && openTimer !== handledOpen) {
    setHandledOpen(openTimer);
    setActiveTab('breast');
    setBreastMode('timer');
  }

  // 2. Bottle States
  const [bottleAmount, setBottleAmount] = useState(120); // default 120ml
  const [bottleType, setBottleType] = useState<'formula' | 'breastmilk'>('formula');

  // 3. Solid States
  const [foodDescription, setFoodDescription] = useState('');
  const [amountCategory, setAmountCategory] = useState<'few_bites' | 'medium_bowl' | 'large_bowl'>('few_bites');

  // Popular solid foods tags
  const popularFoods = ['Oatmeal', 'Purée Apple', 'Avocado', 'Banana Puree', 'Sweet Potato'];

  const timerRequest = useRef(0);
  const loadTimer = useCallback(async () => {
    const request = ++timerRequest.current;
    setTimerReady(false);
    try {
      const saved = await StorageService.getNursingSession(activeBaby.id);
      if (timerRequest.current !== request) return;
      setSession(saved);
      setConfirmDiscard(false);
      setTimerReady(true);
    } catch {
      if (timerRequest.current === request) {
        show({ title: 'Could not load timer', description: 'Reopen Log Feed to retry.' });
      }
    }
  }, [activeBaby.id, show]);

  useFocusEffect(useCallback(() => {
    void loadTimer();
    return () => { timerRequest.current++; };
  }, [loadTimer]));

  const changeTimer = async (action: NursingSide | 'pause' | 'discard') => {
    if (!timerReady || savingFeed.current) return false;
    savingFeed.current = true;
    try {
      if (action === 'discard' && session) {
        await StorageService.discardNursing(session);
        setSession(null);
      } else if (action !== 'discard') {
        setSession(await StorageService.setNursingSide(activeBaby.id, session, action === 'pause' ? null : action));
      }
      setConfirmDiscard(false);
      return true;
    } catch (error) {
      show({ title: 'Timer not updated', description: error instanceof ActiveBabyChangedError
        ? `Select ${activeBaby.name} again to update this timer.`
        : error instanceof NursingSessionChangedError ? error.message : 'Please try again.' });
      if (error instanceof NursingSessionChangedError) await loadTimer();
      return false;
    } finally {
      savingFeed.current = false;
    }
  };

  const handleSaveFeed = async () => {
    let finalTimestamp = new Date();
    if (hasCustomTime) {
      let hr = selectedHour;
      if (selectedAmPm === 'PM' && hr < 12) hr += 12;
      if (selectedAmPm === 'AM' && hr === 12) hr = 0;

      finalTimestamp.setHours(hr);
      finalTimestamp.setMinutes(selectedMinute);
      finalTimestamp.setSeconds(0);
      finalTimestamp.setMilliseconds(0);
    }

    let logDetails: FeedingLog['details'] = {};

    const isLiveTimer = activeTab === 'breast' && breastMode === 'timer';
    if (isLiveTimer) {
      if (!timerReady || !session) {
        show({ title: 'Start a nursing timer first' });
        return;
      }
      const elapsed = nursingDurations(session, Date.now());
      if (!elapsed.leftDuration && !elapsed.rightDuration) {
        show({ title: 'Run the timer for at least one second' });
        return;
      }
    } else if (activeTab === 'breast') {
      const leftMins = parseInt(leftManualMins || '0', 10);
      const rightMins = parseInt(rightManualMins || '0', 10);
      if (leftMins === 0 && rightMins === 0) {
        Alert.alert('Empty Nursing', 'Please enter nursing minutes for at least one side.');
        return;
      }
      logDetails = { breast: { leftDuration: leftMins * 60, rightDuration: rightMins * 60, lastBreastUsed: manualSide } };
    } else if (activeTab === 'bottle') {
      if (bottleAmount <= 0) {
        Alert.alert('Invalid Amount', 'Please input a valid feeding volume.');
        return;
      }
      logDetails = {
        bottle: {
          amount: bottleAmount,
          bottleType,
        },
      };
    } else if (activeTab === 'solid') {
      if (!foodDescription.trim()) {
        Alert.alert('Solid Description Required', 'Please enter or select a description of the solid food.');
        return;
      }
      logDetails = {
        solid: {
          foodDescription: foodDescription.trim(),
          amountCategory,
        },
      };
    }

    if (savingFeed.current) return;
    savingFeed.current = true;
    try {
      const timestamp = finalTimestamp.toISOString();
      const trimmedNotes = notes.trim() || undefined;
      if (isLiveTimer && session) {
        setSession(await StorageService.finishNursing(session, timestamp, trimmedNotes));
        setConfirmDiscard(false);
      } else {
        await StorageService.saveLog({
          id: newLogId(), babyId: activeBaby.id, type: activeTab, timestamp, notes: trimmedNotes, details: logDetails,
        }, { requireActiveBaby: true });
      }
    } catch (error) {
      show({
        title: 'Feeding not saved',
        description: error instanceof ActiveBabyChangedError
          ? `Select ${activeBaby.name} again to save this entry.`
          : error instanceof NursingSessionChangedError ? error.message : 'Your entry is still here. Please try again.',
      });
      if (error instanceof NursingSessionChangedError) await loadTimer();
      return;
    } finally {
      savingFeed.current = false;
    }
    confettiRef.current?.trigger();
    show({
      title: 'Feeding logged',
      description: 'Session saved to history.',
      icon: FEED_TYPE_ICON[activeTab],
      tone: FEED_TYPE_COLOR[activeTab],
    });

    // Reset Forms (toast is non-blocking, so reset immediately)
    setNotes('');
    setFoodDescription('');
    setAmountCategory('few_bites');
    setManualSide(null);
    setLeftManualMins('');
    setRightManualMins('');
    setHasCustomTime(false);
    setSelectedHour(new Date().getHours() % 12 || 12);
    setSelectedMinute(new Date().getMinutes());
    setSelectedAmPm(new Date().getHours() >= 12 ? 'PM' : 'AM');
  };

  // Convert volume unit displays
  const isOz = settings?.volumeUnit === 'oz';
  const getVolumeDisplay = (ml: number) => {
    if (isOz) {
      return `${(ml * 0.033814).toFixed(1)} oz`;
    }
    return `${ml} ml`;
  };

  const quickBottlePresets = [60, 90, 120, 150, 180, 240];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <ThemedView style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <ThemedText type="title" style={styles.headerTitle}>
                  Log Feeding
                </ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Recording for: <ThemedText type="smallBold" style={{ color: colors.primary }}>{activeBaby?.name || 'Nursery Baby'}</ThemedText>
                </ThemedText>
              </View>
              <View style={[styles.avatarBadge, { backgroundColor: colors.primary + '20' }]}>
                <AppIcon name="milk" size={20} color={colors.primary} />
              </View>
            </View>
          </ThemedView>

          {/* Elegant Custom Tab Selector */}
          <View style={[styles.tabContainer, { backgroundColor: colors.backgroundElement }]}>
            {(['breast', 'bottle', 'solid'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const tabColor = tab === 'breast' ? colors.breast : tab === 'bottle' ? colors.bottle : colors.solid;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={({ pressed }) => [
                    styles.tabButton,
                    {
                      backgroundColor: isActive ? tabColor : 'transparent',
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    style={{
                      color: isActive ? '#FFFFFF' : colors.textSecondary,
                    }}
                  >
                    {tab.toUpperCase()}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* Form Card */}
          <ThemedView type="backgroundElement" style={styles.formCard}>
                     {/* 1. BREAST NURSING DESIGN */}
            {activeTab === 'breast' && (
              <View style={styles.sectionContainer}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Breast Nursing</ThemedText>
                
                {/* Breast Mode Toggle */}
                <View style={styles.breastModeToggleRow}>
                  <Pressable
                    onPress={() => setBreastMode('timer')}
                    style={({ pressed }) => [
                      styles.breastModeToggleBtn,
                      {
                        backgroundColor: breastMode === 'timer' ? colors.breast : colors.backgroundSelected,
                        borderTopLeftRadius: 12,
                        borderBottomLeftRadius: 12,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                    ]}
                  >
                    <View style={styles.toggleBtnInner}>
                      <AppIcon name="timer" size={14} color={breastMode === 'timer' ? '#FFFFFF' : colors.text} />
                      <ThemedText type="smallBold" style={{ color: breastMode === 'timer' ? '#FFFFFF' : colors.text }}>
                        LIVE TIMER
                      </ThemedText>
                    </View>
                  </Pressable>
                  <Pressable
                    disabled={!timerReady}
                    onPress={async () => {
                      if (!timerActive || await changeTimer('pause')) setBreastMode('manual');
                    }}
                    style={({ pressed }) => [
                      styles.breastModeToggleBtn,
                      {
                        backgroundColor: breastMode === 'manual' ? colors.breast : colors.backgroundSelected,
                        borderTopRightRadius: 12,
                        borderBottomRightRadius: 12,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                    ]}
                  >
                    <View style={styles.toggleBtnInner}>
                      <AppIcon name="penLine" size={14} color={breastMode === 'manual' ? '#FFFFFF' : colors.text} />
                      <ThemedText type="smallBold" style={{ color: breastMode === 'manual' ? '#FFFFFF' : colors.text }}>
                        MANUAL INPUT
                      </ThemedText>
                    </View>
                  </Pressable>
                </View>

                {breastMode === 'timer' ? (
                  <>
                    <ThemedText type="small" style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: Spacing.one }]}>
                      Track time on each side. Start/pause as needed.
                    </ThemedText>

                    <View style={styles.breastTimerRow}>
                      {/* Left Side */}
                      <View style={[styles.breastCard, { borderColor: timerActive === 'left' ? colors.breast : colors.cardBorder }]}>
                        <ThemedText type="smallBold" style={{ color: colors.textSecondary }}>LEFT SIDE</ThemedText>
                        <ThemedText
                          style={[styles.timerDigit, { color: leftSeconds > 0 ? colors.breast : colors.text }]}
                          numberOfLines={1}
                          maxFontSizeMultiplier={1}
                        >
                          {formatNursingTime(leftSeconds)}
                        </ThemedText>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={timerActive === 'left' ? 'Pause left timer' : 'Start left timer'}
                          disabled={!timerReady}
                          onPress={() => changeTimer(timerActive === 'left' ? 'pause' : 'left')}
                          style={({ pressed }) => [
                            styles.timerBtn,
                            {
                              backgroundColor: timerActive === 'left' ? colors.primary + '30' : colors.backgroundSelected,
                              transform: [{ scale: pressed ? 0.90 : 1 }],
                            },
                          ]}
                        >
                          <AppIcon
                            name={timerActive === 'left' ? 'pause' : 'play'}
                            size={18}
                            color={timerActive === 'left' ? colors.primary : colors.text}
                          />
                        </Pressable>
                      </View>

                      {/* Right Side */}
                      <View style={[styles.breastCard, { borderColor: timerActive === 'right' ? colors.breast : colors.cardBorder }]}>
                        <ThemedText type="smallBold" style={{ color: colors.textSecondary }}>RIGHT SIDE</ThemedText>
                        <ThemedText
                          style={[styles.timerDigit, { color: rightSeconds > 0 ? colors.breast : colors.text }]}
                          numberOfLines={1}
                          maxFontSizeMultiplier={1}
                        >
                          {formatNursingTime(rightSeconds)}
                        </ThemedText>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={timerActive === 'right' ? 'Pause right timer' : 'Start right timer'}
                          disabled={!timerReady}
                          onPress={() => changeTimer(timerActive === 'right' ? 'pause' : 'right')}
                          style={({ pressed }) => [
                            styles.timerBtn,
                            {
                              backgroundColor: timerActive === 'right' ? colors.primary + '30' : colors.backgroundSelected,
                              transform: [{ scale: pressed ? 0.90 : 1 }],
                            },
                          ]}
                        >
                          <AppIcon
                            name={timerActive === 'right' ? 'pause' : 'play'}
                            size={18}
                            color={timerActive === 'right' ? colors.primary : colors.text}
                          />
                        </Pressable>
                      </View>
                    </View>

                    {/* Last Used Info */}
                    {lastBreastUsed && (
                      <View style={[styles.infoBadge, { backgroundColor: colors.backgroundSelected, marginTop: Spacing.two }]}>
                        <ThemedText type="small">
                          Last nursed side: <ThemedText type="smallBold" style={{ color: colors.primary }}>{lastBreastUsed.toUpperCase()}</ThemedText>
                        </ThemedText>
                      </View>
                    )}
                    {session && (
                      <View style={styles.timerActions}>
                        {confirmDiscard ? (
                          <>
                            <Pressable accessibilityRole="button" onPress={() => setConfirmDiscard(false)}>
                              <ThemedText type="smallBold">Keep timer</ThemedText>
                            </Pressable>
                            <Pressable accessibilityRole="button" onPress={() => changeTimer('discard')}>
                              <ThemedText type="smallBold">Confirm discard</ThemedText>
                            </Pressable>
                          </>
                        ) : (
                          <Pressable accessibilityRole="button" onPress={() => setConfirmDiscard(true)}>
                            <ThemedText type="small" style={{ color: colors.textSecondary }}>Discard timer</ThemedText>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <ThemedText type="small" style={[styles.sectionSubtitle, { color: colors.textSecondary, marginTop: Spacing.one }]}>
                      Directly enter the duration spent on each side.
                    </ThemedText>

                    <View style={styles.manualInputRow}>
                      {/* Left manual input */}
                      <View style={[styles.manualCard, { borderColor: colors.cardBorder }]}>
                        <ThemedText type="smallBold" style={{ color: colors.textSecondary }}>LEFT SIDE (MINS)</ThemedText>
                        <TextInput
                          style={[styles.manualTextInput, { color: colors.text, backgroundColor: colors.background }]}
                          placeholder="0"
                          placeholderTextColor={colors.textSecondary + '70'}
                          value={leftManualMins}
                          onChangeText={(val) => {
                            const num = val.replace(/[^0-9]/g, '');
                            setLeftManualMins(num);
                          }}
                          keyboardType="number-pad"
                        />
                      </View>

                      {/* Right manual input */}
                      <View style={[styles.manualCard, { borderColor: colors.cardBorder }]}>
                        <ThemedText type="smallBold" style={{ color: colors.textSecondary }}>RIGHT SIDE (MINS)</ThemedText>
                        <TextInput
                          style={[styles.manualTextInput, { color: colors.text, backgroundColor: colors.background }]}
                          placeholder="0"
                          placeholderTextColor={colors.textSecondary + '70'}
                          value={rightManualMins}
                          onChangeText={(val) => {
                            const num = val.replace(/[^0-9]/g, '');
                            setRightManualMins(num);
                          }}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    {/* Last Used Selection (Optional) */}
                    <View style={styles.lastBreastSelectorGroup}>
                      <ThemedText type="smallBold" style={{ color: colors.textSecondary, marginBottom: Spacing.two }}>
                        LAST NURSED SIDE (OPTIONAL)
                      </ThemedText>
                      <View style={styles.sideSelectorRow}>
                        <Pressable
                          onPress={() => setManualSide('left')}
                          style={({ pressed }) => [
                            styles.sideBtn,
                            {
                              backgroundColor: manualSide === 'left' ? colors.breast + '30' : colors.backgroundSelected,
                              borderColor: manualSide === 'left' ? colors.breast : colors.cardBorder,
                              transform: [{ scale: pressed ? 0.95 : 1 }],
                            },
                          ]}
                        >
                          <View style={styles.toggleBtnInner}>
                            <AppIcon name="arrowLeft" size={14} color={manualSide === 'left' ? colors.breast : colors.text} />
                            <ThemedText type="smallBold" style={{ color: manualSide === 'left' ? colors.breast : colors.text }}>
                              LEFT SIDE
                            </ThemedText>
                          </View>
                        </Pressable>

                        <Pressable
                          onPress={() => setManualSide('right')}
                          style={({ pressed }) => [
                            styles.sideBtn,
                            {
                              backgroundColor: manualSide === 'right' ? colors.breast + '30' : colors.backgroundSelected,
                              borderColor: manualSide === 'right' ? colors.breast : colors.cardBorder,
                              transform: [{ scale: pressed ? 0.95 : 1 }],
                            },
                          ]}
                        >
                          <View style={styles.toggleBtnInner}>
                            <AppIcon name="arrowRight" size={14} color={manualSide === 'right' ? colors.breast : colors.text} />
                            <ThemedText type="smallBold" style={{ color: manualSide === 'right' ? colors.breast : colors.text }}>
                              RIGHT SIDE
                            </ThemedText>
                          </View>
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* 2. BOTTLE DESIGN */}
            {activeTab === 'bottle' && (
              <View style={styles.sectionContainer}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Bottle Feeding</ThemedText>
                
                {/* Milk Type Toggle */}
                <View style={styles.milkToggleRow}>
                  <Pressable
                    onPress={() => setBottleType('formula')}
                    style={({ pressed }) => [
                      styles.milkToggleBtn,
                      {
                        backgroundColor: bottleType === 'formula' ? colors.bottle : colors.backgroundSelected,
                        borderTopLeftRadius: 12,
                        borderBottomLeftRadius: 12,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                    ]}
                  >
                    <ThemedText type="smallBold" style={{ color: bottleType === 'formula' ? '#FFFFFF' : colors.text }}>
                      FORMULA
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setBottleType('breastmilk')}
                    style={({ pressed }) => [
                      styles.milkToggleBtn,
                      {
                        backgroundColor: bottleType === 'breastmilk' ? colors.bottle : colors.backgroundSelected,
                        borderTopRightRadius: 12,
                        borderBottomRightRadius: 12,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                    ]}
                  >
                    <ThemedText type="smallBold" style={{ color: bottleType === 'breastmilk' ? '#FFFFFF' : colors.text }}>
                      BREAST MILK
                    </ThemedText>
                  </Pressable>
                </View>

                {/* Visual Amount Display */}
                <View style={styles.amountDisplayCard}>
                  <ThemedText style={styles.amountText}>{getVolumeDisplay(bottleAmount)}</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>Volume logged</ThemedText>
                </View>

                {/* Quick Add Presets */}
                <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Quick Preset Adders</ThemedText>
                <View style={styles.presetGrid}>
                  {quickBottlePresets.map((preset) => (
                    <Pressable
                      key={preset}
                      onPress={() => setBottleAmount(preset)}
                      style={({ pressed }) => [
                        styles.presetBtn,
                        {
                          backgroundColor: bottleAmount === preset ? colors.bottle + '30' : colors.backgroundSelected,
                          borderColor: bottleAmount === preset ? colors.bottle : colors.cardBorder,
                          transform: [{ scale: pressed ? 0.94 : 1 }],
                        },
                      ]}
                    >
                      <ThemedText type="smallBold" style={{ color: bottleAmount === preset ? colors.primary : colors.text }}>
                        {getVolumeDisplay(preset)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                {/* Adjusters */}
                <View style={styles.adjusterRow}>
                  <Pressable
                    onPress={() => setBottleAmount((prev) => Math.max(0, prev - 10))}
                    style={({ pressed }) => [
                      styles.adjustBtn,
                      {
                        backgroundColor: colors.backgroundSelected,
                        transform: [{ scale: pressed ? 0.90 : 1 }],
                      },
                    ]}
                  >
                    <ThemedText style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>-</ThemedText>
                  </Pressable>
                  <ThemedText type="bold">Adjust Amount (10ml)</ThemedText>
                  <Pressable
                    onPress={() => setBottleAmount((prev) => prev + 10)}
                    style={({ pressed }) => [
                      styles.adjustBtn,
                      {
                        backgroundColor: colors.backgroundSelected,
                        transform: [{ scale: pressed ? 0.90 : 1 }],
                      },
                    ]}
                  >
                    <ThemedText style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>+</ThemedText>
                  </Pressable>
                </View>
              </View>
            )}

            {/* 3. SOLID DESIGN */}
            {activeTab === 'solid' && (
              <View style={styles.sectionContainer}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Solid Food</ThemedText>

                <View style={styles.formGroup}>
                  <ThemedText type="smallBold">Food Description</ThemedText>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
                    placeholder="e.g. Rice cereal, mashed avocado"
                    placeholderTextColor={colors.textSecondary + '70'}
                    value={foodDescription}
                    onChangeText={setFoodDescription}
                  />
                </View>

                {/* Popular Tags */}
                <View style={styles.tagGrid}>
                  {popularFoods.map((food) => (
                    <Pressable
                      key={food}
                      onPress={() => setFoodDescription(food)}
                      style={({ pressed }) => [
                        styles.tagBtn,
                        {
                          backgroundColor: foodDescription === food ? colors.solid + '40' : colors.backgroundSelected,
                          transform: [{ scale: pressed ? 0.94 : 1 }],
                        },
                      ]}
                    >
                      <ThemedText type="small" style={{ color: colors.text }}>{food}</ThemedText>
                    </Pressable>
                  ))}
                </View>

                {/* Portion category selector */}
                <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Portion Category</ThemedText>
                <View style={styles.portionRow}>
                  {(['few_bites', 'medium_bowl', 'large_bowl'] as const).map((cat) => {
                    const label = cat === 'few_bites' ? 'Few Bites' : cat === 'medium_bowl' ? 'Medium Bowl' : 'Large Bowl';
                    const active = amountCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setAmountCategory(cat)}
                        style={({ pressed }) => [
                          styles.portionBtn,
                          {
                            backgroundColor: active ? colors.solid : colors.backgroundSelected,
                            transform: [{ scale: pressed ? 0.95 : 1 }],
                          },
                        ]}
                      >
                        <ThemedText
                          type="smallBold"
                          style={{ color: active ? '#4A3B18' : colors.text }}
                        >
                          {label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

            {/* Custom Feeding Time field */}
            <View style={styles.formGroup}>
              <ThemedText type="smallBold">Feeding Time</ThemedText>
              <Pressable
                onPress={() => setIsTimePickerVisible(true)}
                style={({ pressed }) => [
                  styles.input,
                  styles.timePickerTrigger,
                  {
                    borderColor: colors.cardBorder,
                    backgroundColor: colors.background,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <View style={styles.timePickerLabelRow}>
                  <AppIcon name="clock" size={16} color={hasCustomTime ? colors.text : colors.textSecondary} />
                  <ThemedText
                    numberOfLines={2}
                    style={{ flexShrink: 1, color: hasCustomTime ? colors.text : colors.textSecondary + 'B0' }}>
                    {hasCustomTime ? `Custom: ${formatSelectedTime()}` : `Logged: Current Time (${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })})`}
                  </ThemedText>
                </View>
                <ThemedText style={{ color: activeTab === 'breast' ? colors.breast : activeTab === 'bottle' ? colors.bottle : colors.solid, fontSize: 12, fontWeight: 'bold', flexShrink: 0 }}>
                  CHANGE
                </ThemedText>
              </Pressable>
            </View>

            {/* Beautiful Clock Dial / Time Picker Modal */}
            <Modal
              visible={isTimePickerVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setIsTimePickerVisible(false)}
            >
              <View style={styles.modalBackdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsTimePickerVisible(false)} />
                
                <ThemedView type="backgroundElement" style={[styles.modalCard, { borderColor: colors.backgroundSelected }]}>
                  <ThemedText type="bold" style={styles.modalTitle}>
                    Select Feeding Time
                  </ThemedText>
                  
                  <ThemedText type="small" style={{ color: colors.textSecondary, marginBottom: Spacing.four, textAlign: 'center' }}>
                    Scroll and tap to select the exact feeding time
                  </ThemedText>

                  <View style={styles.dialContainer}>
                    {/* Hour Column */}
                    <View style={styles.dialColumnContainer}>
                      <ThemedText type="smallBold" style={styles.columnLabel}>HOUR</ThemedText>
                      <ScrollView style={styles.dialScrollView} showsVerticalScrollIndicator={false}>
                        {hoursArray.map((h) => {
                          const isSelected = selectedHour === h;
                          const highlightColor = activeTab === 'breast' ? colors.breast : activeTab === 'bottle' ? colors.bottle : colors.solid;
                          return (
                            <Pressable
                              key={h}
                              onPress={() => setSelectedHour(h)}
                              style={[
                                styles.dialItem,
                                {
                                  backgroundColor: isSelected ? highlightColor : 'transparent',
                                },
                              ]}
                            >
                              <ThemedText
                                type={isSelected ? 'bold' : 'default'}
                                style={{ color: isSelected ? '#FFFFFF' : colors.text }}
                              >
                                {h.toString().padStart(2, '0')}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Minute Column */}
                    <View style={styles.dialColumnContainer}>
                      <ThemedText type="smallBold" style={styles.columnLabel}>MINUTE</ThemedText>
                      <ScrollView style={styles.dialScrollView} showsVerticalScrollIndicator={false}>
                        {minutesArray.map((m) => {
                          const isSelected = selectedMinute === m;
                          const highlightColor = activeTab === 'breast' ? colors.breast : activeTab === 'bottle' ? colors.bottle : colors.solid;
                          return (
                            <Pressable
                              key={m}
                              onPress={() => setSelectedMinute(m)}
                              style={[
                                styles.dialItem,
                                {
                                  backgroundColor: isSelected ? highlightColor : 'transparent',
                                },
                              ]}
                            >
                              <ThemedText
                                type={isSelected ? 'bold' : 'default'}
                                style={{ color: isSelected ? '#FFFFFF' : colors.text }}
                              >
                                {m.toString().padStart(2, '0')}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* AM/PM Column */}
                    <View style={styles.dialColumnContainer}>
                      <ThemedText type="smallBold" style={styles.columnLabel}>PERIOD</ThemedText>
                      <ScrollView style={styles.dialScrollView} showsVerticalScrollIndicator={false}>
                        {ampmArray.map((p) => {
                          const isSelected = selectedAmPm === p;
                          const highlightColor = activeTab === 'breast' ? colors.breast : activeTab === 'bottle' ? colors.bottle : colors.solid;
                          return (
                            <Pressable
                              key={p}
                              onPress={() => setSelectedAmPm(p)}
                              style={[
                                styles.dialItem,
                                {
                                  backgroundColor: isSelected ? highlightColor : 'transparent',
                                },
                              ]}
                            >
                              <ThemedText
                                type={isSelected ? 'bold' : 'default'}
                                style={{ color: isSelected ? '#FFFFFF' : colors.text }}
                              >
                                {p}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>

                  {/* Modal Buttons */}
                  <View style={[styles.modalButtonsRow, { marginTop: Spacing.four }]}>
                    <Pressable
                      onPress={() => {
                        setHasCustomTime(false);
                        setIsTimePickerVisible(false);
                      }}
                      style={({ pressed }) => [
                        styles.modalBtn,
                        {
                          backgroundColor: colors.backgroundSelected,
                          transform: [{ scale: pressed ? 0.95 : 1 }],
                        },
                      ]}
                    >
                      <ThemedText type="smallBold" style={{ color: colors.textSecondary }}>
                        Reset Current
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setHasCustomTime(true);
                        setIsTimePickerVisible(false);
                      }}
                      style={({ pressed }) => [
                        styles.modalBtn,
                        {
                          backgroundColor: activeTab === 'breast' ? colors.breast : activeTab === 'bottle' ? colors.bottle : colors.solid,
                          transform: [{ scale: pressed ? 0.95 : 1 }],
                        },
                      ]}
                    >
                      <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
                        Set Time
                      </ThemedText>
                    </Pressable>
                  </View>
                </ThemedView>
              </View>
            </Modal>

            {/* Common Notes field */}
            <View style={styles.formGroup}>
              <ThemedText type="smallBold">Notes & Observations</ThemedText>
              <TextInput
                style={[styles.input, styles.notesInput, { color: colors.text, borderColor: colors.cardBorder }]}
                placeholder="Spit up slightly, very hungry, fell asleep..."
                placeholderTextColor={colors.textSecondary + '70'}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Save Feed Button */}
            <Pressable
              onPress={handleSaveFeed}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor:
                    activeTab === 'breast'
                      ? colors.breast
                      : activeTab === 'bottle'
                      ? colors.bottle
                      : colors.solid,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <ThemedText type="bold" style={{ color: '#FFFFFF' }}>
                SAVE FEEDING SESSION
              </ThemedText>
            </Pressable>

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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: Spacing.half,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.four,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionContainer: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: -Spacing.two,
  },
  breastTimerRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  breastCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  timerActions: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.four },
  timerDigit: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 'bold',
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  toggleBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  timerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBadge: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  milkToggleRow: {
    flexDirection: 'row',
  },
  milkToggleBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  amountDisplayCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  amountText: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  presetBtn: {
    width: '31%',
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  adjusterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  adjustBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formGroup: {
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    fontSize: 15,
  },
  notesInput: {
    textAlignVertical: 'top',
    height: 80,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tagBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 12,
  },
  portionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  portionBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    alignItems: 'center',
  },
  divider: {
    height: 1,
    opacity: 0.1,
  },
  saveButton: {
    paddingVertical: Spacing.three,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: Spacing.two,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  breastModeToggleRow: {
    flexDirection: 'row',
    marginBottom: Spacing.three,
    marginTop: Spacing.two,
  },
  breastModeToggleBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  manualCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  manualTextInput: {
    width: '100%',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    paddingVertical: Spacing.two,
    borderRadius: 8,
    borderWidth: 0,
  },
  lastBreastSelectorGroup: {
    marginTop: Spacing.four,
    width: '100%',
  },
  sideSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  sideBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  timePickerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
    flex: 1,
  },
  dialContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
    width: '100%',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
    padding: Spacing.two,
  },
  dialColumnContainer: {
    flex: 1,
    alignItems: 'center',
  },
  columnLabel: {
    fontSize: 10,
    color: 'gray',
    marginBottom: Spacing.one,
  },
  dialScrollView: {
    height: 160,
    width: '100%',
  },
  dialItem: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginVertical: 1,
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: Spacing.two,
    textAlign: 'center',
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
});
