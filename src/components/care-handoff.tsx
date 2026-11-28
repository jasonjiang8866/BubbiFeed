import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { buildCareHandoff } from '@/utils/care-handoff';

type Props = { summary: ReturnType<typeof buildCareHandoff>; onClose: () => void };

export function CareHandoff({ summary, onClose }: Props) {
  const colors = useTheme();
  const busy = useRef(false);
  const [feedback, setFeedback] = useState('');
  const web = Platform.OS === 'web';
  const copy = web && typeof navigator.share !== 'function';
  const manual = copy && !navigator.clipboard?.writeText;

  async function share() {
    if (busy.current) return;
    busy.current = true;
    setFeedback('');
    try {
      if (!web) {
        await Share.share({ message: summary.message });
      } else if (copy) {
        await navigator.clipboard.writeText(summary.message);
        setFeedback('Summary copied.');
      } else {
        await navigator.share({ text: summary.message });
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setFeedback('Could not share. Try again or select the text to copy.');
      }
    } finally {
      busy.current = false;
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.sheet, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close handoff" onPress={onClose} style={styles.close}>
            <ThemedText type="smallBold">Done</ThemedText>
          </Pressable>
          <View style={styles.header}>
            <ThemedText selectable accessibilityRole="header" type="title">{summary.title}</ThemedText>
            <ThemedText selectable type="small" themeColor="textSecondary">{summary.asOf}</ThemedText>
          </View>
          {summary.sections.map(section => (
            <View key={section.heading} style={[styles.section, { backgroundColor: colors.backgroundElement }]}>
              <ThemedText selectable type="smallBold">{section.heading}</ThemedText>
              {section.lines.map((line, index) => <ThemedText selectable key={index}>{line}</ThemedText>)}
            </View>
          ))}
          {manual ? <ThemedText type="small">Select the summary text to copy it.</ThemedText> : (
            <Pressable accessibilityRole="button" onPress={share} style={[styles.share, { backgroundColor: colors.bottle }]}>
              <ThemedText type="bold" style={{ color: '#203332' }}>{copy ? 'Copy handoff' : 'Share handoff'}</ThemedText>
            </Pressable>
          )}
          {feedback ? <ThemedText accessibilityLiveRegion="polite" type="small">{feedback}</ThemedText> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 20, paddingBottom: 32, gap: 14 },
  close: { alignSelf: 'flex-end', justifyContent: 'center', minHeight: 44, paddingHorizontal: 10 },
  header: { gap: 6 },
  section: { borderRadius: 16, padding: 16, gap: 8 },
  share: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
