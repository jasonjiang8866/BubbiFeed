import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { draftFeedingTime, type FeedingTimeDraft } from '@/utils/feeding-time';

type Props = {
  value: FeedingTimeDraft | null;
  onChange: (value: FeedingTimeDraft | null) => void;
  original?: string;
};

function ClockInput({ value, onChange }: { value: string; onChange: (clock: string) => void }) {
  const colors = useTheme();
  const initial = useRef(value);
  return (
    <TextInput accessibilityLabel="Feeding time in 24-hour format" placeholder="23:50"
      defaultValue={initial.current} onChangeText={onChange} keyboardType="numbers-and-punctuation"
      selectTextOnFocus maxLength={5} returnKeyType="done"
      style={[styles.clock, { color: colors.text, borderColor: colors.cardBorder }]} />
  );
}

export function FeedingTimeField({ value, onChange, original }: Props) {
  const colors = useTheme();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const date = value?.day ?? (original ? new Date(original) : today);
  const fullDate = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const choices = [{ label: 'Today', day: today }, { label: 'Yesterday', day: yesterday }];
  if (original) {
    const saved = new Date(original);
    if (!choices.some(choice => choice.day.toDateString() === saved.toDateString())) {
      choices.push({ label: saved.toLocaleDateString(), day: saved });
    }
  }
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">Feeding time</ThemedText>
      {value ? (
        <>
          <View style={styles.row}>
            {choices.map(({ label, day }) => {
              const selected = value.day.toDateString() === day.toDateString();
              return (
                <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected }}
                  onPress={() => onChange({ ...value, day })}
                  style={[styles.choice, { backgroundColor: selected ? colors.primary : colors.backgroundSelected }]}>
                  <ThemedText type="smallBold" style={{ color: selected ? '#fff' : colors.text }}>{label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="small">{fullDate} · 24-hour time</ThemedText>
          <ClockInput value={value.clock} onChange={clock => onChange({ ...value, clock })} />
          <Pressable accessibilityRole="button" onPress={() => onChange(null)} style={styles.action}>
            <ThemedText type="smallBold" style={{ color: colors.primary }}>{original ? 'Restore original time' : 'Use current time'}</ThemedText>
          </Pressable>
        </>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Change feeding time"
          onPress={() => onChange(draftFeedingTime(original ? new Date(original) : new Date()))}
          style={[styles.trigger, { borderColor: colors.cardBorder }]}>
          <ThemedText type="small" style={styles.summary}>{original ? fullDate + ' · ' + draftFeedingTime(date).clock : 'Current time'}</ThemedText>
          <ThemedText type="smallBold" style={{ color: colors.primary }}>Change</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center' },
  clock: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 18 },
  action: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  summary: { flexShrink: 1 },
});
