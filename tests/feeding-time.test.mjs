import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftFeedingTime, resolveFeedingTime } from '../src/utils/feeding-time.ts';

process.env.TZ = 'America/New_York';

test('a date chosen before midnight stays on that date after midnight', () => {
  const before = new Date('2026-12-31T23:50:00-05:00');
  const after = new Date('2027-01-01T00:10:00-05:00');
  assert.equal(resolveFeedingTime(draftFeedingTime(before), after), before.toISOString());
  assert.equal(resolveFeedingTime(null, after), after.toISOString());
  for (const clock of ['24:05', '9:60', 'x', '11']) {
    assert.throws(() => resolveFeedingTime({ day: before, clock }, after));
  }
});

test('nonexistent spring times are rejected and unchanged fall times retain their offset and seconds', () => {
  const now = new Date('2026-12-01T12:00:00-05:00');
  assert.throws(() => resolveFeedingTime({ day: new Date('2026-03-08T05:00:00Z'), clock: '02:30' }, now), /does not exist/);
  const original = '2026-11-01T06:30:24.300Z';
  assert.equal(resolveFeedingTime({ day: new Date(original), clock: '0130' }, now, original), original);
});
