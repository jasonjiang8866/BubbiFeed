import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppIcon from '@/components/app-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { AppSettings, BabyProfile, StorageService } from '@/utils/storage';
import { useColorScheme } from 'react-native';

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const [profiles, setProfiles] = useState<BabyProfile[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  // Profile Editor Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<'boy' | 'girl' | 'other'>('boy');
  const [birthWeight, setBirthWeight] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    const profs = await StorageService.getProfiles();
    const sets = await StorageService.getSettings();
    setProfiles(profs);
    setSettings(sets);
  };

  const handleUnitToggle = async () => {
    if (!settings) return;
    const newSettings: AppSettings = {
      ...settings,
      volumeUnit: settings.volumeUnit === 'ml' ? 'oz' : 'ml',
    };
    await StorageService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleSelectBaby = async (babyId: string) => {
    if (!settings) return;
    const newSettings = { ...settings, activeBabyId: babyId };
    await StorageService.saveSettings(newSettings);
    setSettings(newSettings);
  };

  const startAddProfile = () => {
    setIsEditing(true);
    setEditingId(null);
    setName('');
    setBirthDate(new Date().toISOString().split('T')[0]);
    setGender('boy');
    setBirthWeight('3200');
  };

  const startEditProfile = (profile: BabyProfile) => {
    setIsEditing(true);
    setEditingId(profile.id);
    setName(profile.name);
    setBirthDate(profile.birthDate.split('T')[0]);
    setGender(profile.gender);
    setBirthWeight(profile.birthWeight.toString());
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a name.');
      return;
    }
    const weightNum = parseInt(birthWeight, 10);
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert('Invalid', 'Please enter a valid birth weight in grams.');
      return;
    }

    let parsedDate: Date;
    try {
      parsedDate = new Date(birthDate);
      if (isNaN(parsedDate.getTime())) throw new Error();
    } catch {
      Alert.alert('Invalid Date', 'Please enter date as YYYY-MM-DD');
      return;
    }

    const newProfile: BabyProfile = {
      id: editingId || `baby-${Date.now()}`,
      name: name.trim(),
      birthDate: parsedDate.toISOString(),
      gender,
      birthWeight: weightNum,
    };

    const updated = await StorageService.saveProfile(newProfile);
    setProfiles(updated);

    // If adding first or active
    if (!settings?.activeBabyId || !editingId) {
      const newSettings: AppSettings = {
        ...(settings || { volumeUnit: 'ml', isDarkMode: false, activeBabyId: newProfile.id }),
        activeBabyId: newProfile.id,
      };
      await StorageService.saveSettings(newSettings);
      setSettings(newSettings);
    }

    setIsEditing(false);
    loadAllData();
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
            const updated = await StorageService.deleteProfile(id);
            setProfiles(updated);
            loadAllData();
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
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
          {!isEditing ? (
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
                const formattedDate = new Date(baby.birthDate).toLocaleDateString(undefined, {
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
                        onPress={() => startEditProfile(baby)}
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
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="bold" style={styles.formTitle}>
                  {editingId ? 'Edit Baby Profile' : 'Add New Baby'}
                </ThemedText>

                <View style={styles.formGroup}>
                  <ThemedText type="smallBold">Baby Name</ThemedText>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
                    placeholder="e.g. Liam, Emma"
                    placeholderTextColor={colors.textSecondary + '70'}
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.formGroup}>
                  <ThemedText type="smallBold">Birth Date (YYYY-MM-DD)</ThemedText>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]}
                    placeholder="2026-05-20"
                    placeholderTextColor={colors.textSecondary + '70'}
                    value={birthDate}
                    onChangeText={setBirthDate}
                    keyboardType="numeric"
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
                    placeholder="e.g. 3200 for 3.2kg"
                    placeholderTextColor={colors.textSecondary + '70'}
                    value={birthWeight}
                    onChangeText={setBirthWeight}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.formActions}>
                  <Pressable
                    onPress={() => setIsEditing(false)}
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
