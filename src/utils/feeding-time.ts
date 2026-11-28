export type FeedingTimeDraft = { day: Date; clock: string };

export function draftFeedingTime(date: Date): FeedingTimeDraft {
  const two = (value: number) => String(value).padStart(2, '0');
  return { day: date, clock: `${two(date.getHours())}:${two(date.getMinutes())}` };
}

export function resolveFeedingTime(draft: FeedingTimeDraft | null, now = new Date(), original?: string): string {
  if (!draft) return original ?? now.toISOString();
  const match = /^(\d{1,2}):?(\d{2})$/.exec(draft.clock.trim());
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);
  if (!match || hour > 23 || minute > 59) throw new Error('Enter a time from 00:00 to 23:59.');

  // Preserve seconds and the original UTC offset for an unchanged time during a DST fold.
  if (original) {
    const saved = new Date(original);
    if (saved.toDateString() === draft.day.toDateString() && saved.getHours() === hour && saved.getMinutes() === minute) {
      return original;
    }
  }
  const chosen = new Date(draft.day);
  chosen.setHours(hour, minute, 0, 0);
  if (chosen.getHours() !== hour || chosen.getMinutes() !== minute) throw new Error('This time does not exist on that date.');
  if (chosen > now) throw new Error('Choose a time in the past or use the current time.');
  return chosen.toISOString();
}
