import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeFeedingWeek } from '../src/utils/weekly-insights.ts';

// This test process has a 25-hour local day on November 1, 2026.
process.env.TZ = 'America/New_York';

const bottle = (timestamp, amount) => ({ type: 'bottle', timestamp, details: { bottle: { amount } } });
const solid = timestamp => ({ type: 'solid', timestamp, details: { solid: {} } });
const nursing = (timestamp, leftDuration, rightDuration) => ({
  type: 'breast', timestamp, details: { breast: { leftDuration, rightDuration } },
});

test('all weekly metrics use the same seven local dates, including the 25-hour day', () => {
  const now = Date.parse('2026-11-06T21:00:00-05:00');
  const records = [
    bottle('2026-10-31T23:00:00-04:00', 30),
    bottle('2026-11-05T23:59:59-05:00', 120),
    bottle('2026-11-06T00:00:00-05:00', 90),
    bottle('2026-10-29T12:00:00-04:00', 150),
    nursing('2026-10-31T00:00:00-04:00', 480, 30),
    nursing('2026-10-30T23:59:59-04:00', 600, 600),
    solid('2026-11-01T01:30:00-04:00'),
    solid('2026-11-01T01:30:00-05:00'),
    solid('2026-10-20T12:00:00-04:00'),
    bottle('2026-11-06T22:00:00-05:00', 60),
  ];
  const week = summarizeFeedingWeek(records, now);
  assert.deepEqual(week.days.map(d => d.bottleMl), [30, 0, 0, 0, 0, 120, 90]);
  assert.deepEqual(week.counts, { breast: 1, bottle: 3, solid: 2 });
  assert.equal(week.nursingSeconds, 510);
  assert.equal(week.bottleMl, 240);
  const atMidnight = summarizeFeedingWeek(records, Date.parse('2026-11-07T00:00:00-05:00'));
  assert.deepEqual(atMidnight.counts, { breast: 0, bottle: 3, solid: 2 });
  assert.deepEqual(atMidnight.days.map(d => d.bottleMl), [0, 0, 0, 0, 120, 150, 0]);
});

test('adding a sixth record for solids changes neither the weekly bottle total nor nursing time', () => {
  const now = Date.parse('2026-11-22T12:00:00-05:00');
  const records = [
    bottle('2026-11-14T08:00:00-05:00', 150),
    bottle('2026-11-21T23:50:00-05:00', 120),
    bottle('2026-11-22T00:10:00-05:00', 90),
    nursing('2026-11-20T12:00:00-05:00', 180, 240),
    solid('2026-11-18T12:00:00-05:00'),
  ];
  for (const [i, logs] of [records, [...records, solid('2026-11-22T08:00:00-05:00')]].entries()) {
    const week = summarizeFeedingWeek(logs, now);
    assert.equal(week.bottleMl, 210);
    assert.equal(week.nursingSeconds, 420);
    assert.deepEqual(week.counts, { breast: 1, bottle: 2, solid: i + 1 });
  }
});

test('intervals use distinct recorded times, retain overnight gaps and have no default', () => {
  const now = Date.parse('2026-11-22T12:00:00-05:00');
  const recent = bottle('2026-11-22T10:00:00-05:00', 90);
  const sameTime = solid(recent.timestamp);
  const expired = solid('2026-10-01T09:00:00-04:00');
  for (const logs of [[], [expired], [recent, expired], [recent, sameTime]]) {
    const week = summarizeFeedingWeek(logs, now);
    assert.equal(week.averageIntervalMs, null);
    assert.equal(week.intervalCount, 0);
  }
  const week = summarizeFeedingWeek([
    recent, expired, solid('2026-11-21T16:00:00-05:00'), sameTime, bottle('2026-11-21T18:00:00-05:00', 120),
  ], now);
  assert.equal(week.intervalCount, 2);
  assert.equal(week.averageIntervalMs, 9 * 60 * 60 * 1000);
});
