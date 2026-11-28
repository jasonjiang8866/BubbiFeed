import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCareHandoff } from '../src/utils/care-handoff.ts';

process.env.TZ = 'Asia/Singapore';
const now = Date.parse('2026-11-28T00:10:00+08:00');
const baby = { id: 'a', name: 'Aster' };
const bottle = (timestamp, amount, babyId = 'a') => ({
  babyId, timestamp, type: 'bottle', notes: 'Private note',
  details: { bottle: { amount, bottleType: 'formula' } },
});

test('handoff counts the local day and shows only the latest three completed feeds for this baby', () => {
  const logs = [
    bottle('2026-11-27T23:50:00+08:00', 120), bottle('2026-11-28T00:05:00+08:00', 90),
    bottle('2026-11-28T00:09:00+08:00', 999, 'other'), bottle('2026-11-28T02:00:00+08:00', 555),
    bottle('bad timestamp', 444), bottle('2026-11-26T10:30:00+08:00', 333),
    { babyId: 'a', timestamp: '2026-11-28T00:08:00+08:00', type: 'breast',
      details: { breast: { leftDuration: 60, rightDuration: 30 } } },
  ];
  const before = structuredClone(logs);
  const summary = buildCareHandoff(baby, logs, { babyId: 'a', side: 'right', runningSince: now }, 'ml', now);
  assert.deepEqual(summary.sections[0].lines, ['1 bottle · 90 ml', 'Nursing · 1 min 30 sec', '0 solid feeds']);
  assert.deepEqual(summary.sections[1].lines, ['Nursing timer · Running · Right side']);
  const recent = summary.sections[2].lines;
  assert.equal(recent.length, 3);
  assert.match(recent[0], /Nursing · L 1 min · R 30 sec/);
  assert.match(recent[1], /90 ml/);
  assert.match(recent[2], /120 ml/);
  assert.doesNotMatch(summary.message, /Private note|999|555|444|333/);
  assert.deepEqual(logs, before);
});

test('empty and paused profiles, solids and ounce settings produce self-contained handoffs', () => {
  const timer = { babyId: 'a', side: 'left', runningSince: null };
  const empty = buildCareHandoff({ id: 'b', name: 'Basil' }, [], timer, 'oz', now);
  assert.match(empty.message, /0 bottles · 0.0 oz/);
  assert.match(empty.message, /No feeds recorded yet/);
  assert.doesNotMatch(empty.message, /In progress|Aster/);
  const result = buildCareHandoff(baby, [bottle('2026-11-28T00:05:00+08:00', 120),
    { babyId: 'a', timestamp: '2026-11-28T00:06:00+08:00', type: 'solid', details: { solid: { foodDescription: 'Pear' } } }],
    timer, 'oz', now);
  assert.match(result.message, /1 bottle · 4.1 oz/);
  assert.match(result.message, /1 solid feed\n/);
  assert.match(result.message, /Solids · Pear/);
  assert.match(result.message, /Nursing timer · Paused · Left side/);
});
