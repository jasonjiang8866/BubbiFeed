import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/toast';
import AppIcon from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { AppSettings, BabyProfile, localCalendarDate, StorageService } from '@/utils/storage';
import { useColorScheme } from 'react-native';

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const [profiles, setProfiles] = useState<BabyProfile[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  // Profile Editor Form State
  const [editor, setEditor] = useState<{ profile: BabyProfile; isNew: boolean } | null>(null);
  const savingProfile = useRef(false);
  const draft = useRef({ name: '', birthDate: '', birthWeight: '' });
  const [gender, setGender] = useState<'boy' | 'girl' | 'other'>('boy');

  const { show } = useToast();
  const request = useRef(0);
  const loadAllData = useCallback(async () => {
    const current = ++request.current;
    try {
      const [profiles, settings] = await Promise.all([StorageService.getProfiles(), StorageService.getSettings()]);
      if (current !== request.current) return;
      setProfiles(profiles);
      setSettings(settings);
    } catch {
      if (current !== request.current) return;
      show({ title: 'Could not load profiles', description: 'Reopen Settings to retry.' });
    }
  }, [show]);

  useFocusEffect(useCallback(() => {
    void loadAllData();
    return () => { request.current++; };
  }, [loadAllData]));

  const updateSettings = async (changes: Partial<AppSettings>) => {
    try {
      setSettings(await StorageService.saveSettings(changes));
    } catch {
      show({ title: 'Settings not saved', description: 'Please try again.' });
    }
  };

  const handleUnitToggle = () => updateSettings({ volumeUnit: settings?.volumeUnit === 'ml' ? 'oz' : 'ml' });
  const handleSelectBaby = (activeBabyId: string) => updateSettings({ activeBabyId });

  const openEditor = (profile: BabyProfile, isNew: boolean) => {
    draft.current = {
      name: profile.name,
      birthDate: profile.birthDate.split('T')[0],
      birthWeight: String(profile.birthWeight),
    };
    setGender(profile.gender);
    setEditor({ profile, isNew });
  };

  const startAddProfile = () => openEditor({
    id: `baby-${Date.now()}`, name: '', birthDate: localCalendarDate(), gender: 'boy', birthWeight: 3200,
  }, true);

  const handleSaveProfile = async () => {
    if (!editor || savingProfile.current) return;
    const { name, birthDate, birthWeight } = draft.current;
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a name.');
      return;
    }
    const weightNum = parseInt(birthWeight, 10);
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert('Invalid', 'Please enter a valid birth weight in grams.');
      return;
    }

    const parsedDate = new Date(birthDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== birthDate) {
      Alert.alert('Invalid Date', 'Please enter a date as YYYY-MM-DD.');
      return;
    }

    const newProfile: BabyProfile = {
      id: editor.profile.id,
      name: name.trim(),
      birthDate,
      gender,
      birthWeight: weightNum,
    };

    savingProfile.current = true;
    try {
      await StorageService.saveProfile(newProfile, editor.isNew || !settings?.activeBabyId);
      Keyboard.dismiss();
      setEditor(null);
      await loadAllData();
    } catch {
      show({ title: 'Profile not saved', description: 'Your changes are still here. Please try again.' });
    } finally {
      savingProfile.current = false;
    }
  };

  const handleDeleteProfile = (id: string) => {
    Alert.alert(
      'Delete Profile',
      'Are you sure you want to delete this profile? This will also delete all feeding logs associated with this baby.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageService.deleteProfile(id);
              await loadAllData();
            } catch {
              show({ title: 'Could not delete profile', description: 'Please try again.' });
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
        >
          
          <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.headerTitle}>
              Settings & Profiles
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Customize your nursery preferences
            </ThemedText>
          </ThemedView>

          {/* Unit Toggle Section */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle">Measurement Preferences</ThemedText>
            </View>
            <View style={styles.settingRow}>
              <View>
                <ThemedText type="bold">Volume Units</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Liquid volume in Bottle tracker
                </ThemedText>
              </View>
              <Pressable
                onPress={handleUnitToggle}
                style={({ pressed }) => [
                  styles.toggleButton,
                  { backgroundColor: colors.backgroundSelected, transform: [{ scale: pressed ? 0.94 : 1 }] },
                ]}
              >
                <ThemedText type="bold" style={{ color: colors.primary }}>
                  {settings?.volumeUnit.toUpperCase() || 'ML'}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          {/* Baby Profiles Section */}
          {!editor ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={[styles.cardHeader, styles.profilesHeader]}>
                <ThemedText type="subtitle" style={{ flexShrink: 1 }} numberOfLines={1}>Baby Profiles</ThemedText>
                <Pressable
                  onPress={startAddProfile}
                  style={({ pressed }) => [
                    styles.addButton,
                    { transform: [{ scale: pressed ? 0.95 : 1 }] }
                  ]}
                >
                  <View style={styles.addButtonInner}>
                    <AppIcon name="plus" size={14} color={colors.primary} />
                    <ThemedText type="smallBold" style={{ color: colors.primary }}>Add Baby</ThemedText>
                  </View>
                </Pressable>
              </View>

              {profiles.map((baby) => {
                const isActive = settings?.activeBabyId === baby.id;
                const formattedDate = new Date(baby.birthDate.split('T')[0]).toLocaleDateString(undefined, {
                  timeZone: 'UTC',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                });
                return (
                  <View
                    key={baby.id}
                    style={[
                      styles.profileItem,
                      { borderColor: isActive ? colors.primary : colors.cardBorder },
                    ]}
                  >
                    <Pressable
                      onPress={() => handleSelectBaby(baby.id)}
                      style={({ pressed }) => [
                        styles.profileMeta,
                        { transform: [{ scale: pressed ? 0.98 : 1 }] }
                      ]}
                    >
                      <View
                        style={[
                          styles.avatar,
                          {
                            backgroundColor:
                              baby.gender === 'boy'
                                ? colors.bottle + '40'
                                : baby.gender === 'girl'
                                ? colors.breast + '40'
                                : colors.solid + '40',
                          },
                        ]}
                      >
                        <AppIcon
                          name="baby"
                          size={22}
                          color={
                            baby.gender === 'boy'
                              ? colors.bottle
                              : baby.gender === 'girl'
                              ? colors.breast
                              : colors.solid
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.one }}>
                          <ThemedText type="bold" numberOfLines={1} style={{ flexShrink: 1 }}>
                            {baby.name}
                          </ThemedText>
                          {isActive && (
                            <View style={[styles.activeBadge, { backgroundColor: colors.primary + '30', flexShrink: 0 }]}>
                              <ThemedText style={{ fontSize: 9, color: colors.primary, fontWeight: 'bold' }}>
                                ACTIVE
                              </ThemedText>
                            </View>
                          )}
                        </View>
                        <ThemedText type="small" style={{ color: colors.textSecondary }}>
                          Born: {formattedDate}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: colors.textSecondary }}>
                          Weight: {(baby.birthWeight / 1000).toFixed(2)} kg
                        </ThemedText>
                      </View>
                    </Pressable>

                    <View style={styles.actionButtons}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${baby.name}`}
                        onPress={() => openEditor(baby, false)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          { transform: [{ scale: pressed ? 0.88 : 1 }] }
                        ]}
                      >
                        <AppIcon name="edit" size={18} color={colors.textSecondary} />
                      </Pressable>
                      {profiles.length > 1 && (
                        <Pressable
                          onPress={() => handleDeleteProfile(baby.id)}
                          style={({ pressed }) => [
                            styles.actionButton,
                            { transform: [{ scale: pressed ? 0.88 : 1 }] }
                          ]}
                        >
                          <AppIcon name="trash" size={18} color={colors.breast} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </ThemedView>
          ) : (
            // Add/Edit Form
            <KeyboardAvoidingView
              enabled={Platform.OS !== 'ios'}
              behavior="height"
              style={Platform.OS === 'ios' ? undefined : { flex: 1 }}
            >
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="bold" style={styles.formTitle}>
                  {editor.isNew ? 'Add New Baby' : 'Edit Baby Profile'}
                </ThemedText>

                <View style={styles.formGroup}>
                  <ThemedText type="smallBold">Baby Name</ThemedText>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
                    placeholder="e.g. Liam, Emma"
                    placeholderTextColor={colors.textSecondary + '70'}
                    defaultValue={editor.profile.name}
                    autoCorrect={false}
                    onChangeText={value => { draft.current.name = value; }}
                  />
                </View>

                <View style={styles.formGroup}>
                  <ThemedText type="smallBold">Birth Date (YYYY-MM-DD)</ThemedText>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
                    placeholder="2026-05-20"
                    placeholderTextColor={colors.textSecondary + '70'}
                    accessibilityLabel="Birth date"
                    defaultValue={editor.profile.birthDate.split('T')[0]}
                    onChangeText={value => { draft.current.birthDate = value; }}
                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                  />
                </View>

                <View style={styles.formGroup}>
                  <ThemedText type="smallBold">Gender</ThemedText>
                  <View style={styles.genderRow}>
                    {(['boy', 'girl', 'other'] as const).map((g) => (
                      <Pressable
                        key={g}
                        onPress={() => setGender(g)}
                        style={({ pressed }) => [
                          styles.genderButton,
                          {
                            backgroundColor: gender === g ? colors.primary : colors.backgroundSelected,
                            transform: [{ scale: pressed ? 0.95 : 1 }],
                          },
                        ]}
                      >
                        <ThemedText
                          type="smallBold"
                          style={{ color: gender === g ? '#FFFFFF' : colors.text }}
                        >
                          {g.toUpperCase()}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <ThemedText type="smallBold">Birth Weight (grams)</ThemedText>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
                    accessibilityLabel="Birth weight in grams"
                    placeholder="e.g. 3200 for 3.2kg"
                    placeholderTextColor={colors.textSecondary + '70'}
                    defaultValue={String(editor.profile.birthWeight)}
                    onChangeText={value => { draft.current.birthWeight = value; }}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.formActions}>
                  <Pressable
                    onPress={() => { if (!savingProfile.current) setEditor(null); }}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnCancel,
                      { backgroundColor: colors.backgroundSelected, transform: [{ scale: pressed ? 0.95 : 1 }] }
                    ]}
                  >
                    <ThemedText type="smallBold">Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveProfile}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnSave,
                      { backgroundColor: colors.primary, transform: [{ scale: pressed ? 0.95 : 1 }] }
                    ]}
                  >
                    <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
                      Save Baby
                    </ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            </KeyboardAvoidingView>
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
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingBottom: Spacing.two,
  },
  profilesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  addButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  toggleButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  profileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  profileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    padding: Spacing.one,
  },
  formTitle: {
    fontSize: 20,
    marginBottom: Spacing.two,
  },
  formGroup: {
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    fontSize: 15,
  },
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  genderButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  btnCancel: {},
  btnSave: {},
});
