import type { FeedingLog, FeedingType } from './storage';

export function summarizeFeedingWeek(logs: readonly FeedingLog[], now: number) {
  const today = new Date(now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
    return {
      key: date.toDateString(),
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      bottleMl: 0,
    };
  });
  const byDate = new Map(days.map(day => [day.key, day]));
  const counts: Record<FeedingType, number> = { breast: 0, bottle: 0, solid: 0 };
  const feedingTimes = new Set<number>();
  let bottleMl = 0;
  let nursingSeconds = 0;

  for (const log of logs) {
    const time = Date.parse(log.timestamp);
    const day = byDate.get(new Date(time).toDateString());
    if (!day || time > now) continue;

    counts[log.type]++;
    feedingTimes.add(time);
    if (log.type === 'bottle' && log.details.bottle) {
      bottleMl += log.details.bottle.amount;
      day.bottleMl += log.details.bottle.amount;
    }
    if (log.type === 'breast' && log.details.breast) {
      nursingSeconds += log.details.breast.leftDuration + log.details.breast.rightDuration;
    }
  }

  const times = [...feedingTimes].sort((a, b) => a - b);
  const intervalCount = Math.max(0, times.length - 1);
  // Adjacent gaps sum to the elapsed time between the first and last distinct timestamps.
  const averageIntervalMs = intervalCount ? (times[times.length - 1] - times[0]) / intervalCount : null;
  return { days, counts, bottleMl, nursingSeconds, intervalCount, averageIntervalMs };
}
