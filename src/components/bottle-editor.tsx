import { useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedingTimeField } from '@/components/feeding-time-field';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { resolveFeedingTime, type FeedingTimeDraft } from '@/utils/feeding-time';
import { StorageService, type FeedingLog } from '@/utils/storage';

type Props = { original: FeedingLog; onClose: () => void; onSaved: () => void };

export function BottleEditor({ original, onClose, onSaved }: Props) {
  const colors = useTheme();
  const originalAmount = String(original.details.bottle!.amount);
  const amount = useRef(originalAmount);
  const notes = useRef(original.notes ?? '');
  const [time, setTime] = useState<FeedingTimeDraft | null>(null);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const close = () => { if (!saving.current) onClose(); };
  const save = async () => {
    if (saving.current) return;
    const volume = Number(amount.current.trim());
    if (!/^\d+(?:\.\d+)?$/.test(amount.current.trim()) || !Number.isFinite(volume) || volume <= 0) {
      setError('Enter a volume greater than zero in ml.');
      return;
    }
    saving.current = true;
    setError('');
    try {
      const timestamp = resolveFeedingTime(time, new Date(), original.timestamp);
      await StorageService.updateBottle(original, { amount: volume, timestamp, notes: notes.current.trim() || undefined });
      Keyboard.dismiss();
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save. Please try again.');
    } finally {
      saving.current = false;
    }
  };

  const inputStyle = [styles.input, { borderColor: colors.cardBorder, color: colors.text }];
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={[styles.sheet, { backgroundColor: colors.background }]}>
        <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title">Edit bottle</ThemedText>
            <Pressable accessibilityRole="button" onPress={close} style={styles.cancel}><ThemedText>Cancel</ThemedText></Pressable>
          </View>
          <View style={styles.group}>
            <ThemedText type="smallBold">Volume (ml)</ThemedText>
            <TextInput accessibilityLabel="Bottle volume in ml" keyboardType="decimal-pad" selectTextOnFocus
              style={inputStyle} defaultValue={originalAmount} onChangeText={value => { amount.current = value; }} />
          </View>
          <FeedingTimeField value={time} onChange={setTime} original={original.timestamp} />
          <View style={styles.group}>
            <ThemedText type="smallBold">Notes</ThemedText>
            <TextInput accessibilityLabel="Bottle notes" multiline style={[inputStyle, styles.notes]}
              defaultValue={original.notes ?? ''} onChangeText={value => { notes.current = value; }} />
          </View>
          {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
          <Pressable accessibilityRole="button" onPress={save} style={[styles.save, { backgroundColor: colors.bottle }]}>
            <ThemedText type="bold" style={{ color: '#203332' }}>Save changes</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  content: { padding: 24, gap: 20, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  group: { gap: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 17, minHeight: 46 },
  notes: { minHeight: 78, textAlignVertical: 'top' },
  save: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
