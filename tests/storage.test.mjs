import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { beforeEach, test } from 'node:test';

const values = new Map();
const profiles = '@feedmybaby_profiles_v1';
const logs = '@feedmybaby_logs_v1';
let failWrite = false;
let failRemove = false;
globalThis.testStorage = {
  async getItem(key) { return values.get(key) ?? null; },
  async setItem(key, value) {
    if (failWrite) throw new Error('disk full');
    values.set(key, value);
  },
  async removeItem(key) {
    if (failRemove) throw new Error('interrupted cleanup');
    values.delete(key);
  },
  async multiSet(entries) {
    for (const [key, value] of entries) await this.setItem(key, value);
  },
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@react-native-async-storage/async-storage') {
      return { url: 'data:text/javascript,export default globalThis.testStorage', shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const { StorageService: store, nursingDurations } = await import('../src/utils/storage.ts');
const feed = (id, babyId = 'A') => ({
  id, babyId, timestamp: '2026-11-21T04:00:00Z', type: 'bottle',
  details: { bottle: { amount: 120, bottleType: 'formula' } },
});
beforeEach(async () => {
  values.clear();
  failWrite = false;
  failRemove = false;
  values.set(profiles, JSON.stringify(['A', 'B'].map(id => ({
    id, name: id, gender: 'other', birthDate: '2026-06-01', birthWeight: 3200,
  }))));
  await store.saveSettings({ activeBabyId: 'A' });
});

test('overlapping writes and deletes preserve all unrelated v1 records', async () => {
  values.set(logs, JSON.stringify([feed('old')]));
  await Promise.all([store.saveLog(feed('first')), store.deleteLog('old'), store.saveLog(feed('second'))]);
  assert.deepEqual((await store.getAllLogs()).map(log => log.id), ['first', 'second']);
});

test('a failed write rejects and retrying the same id leaves one entry', async () => {
  failWrite = true;
  await assert.rejects(store.saveLog(feed('pending')), /disk full/);
  assert.deepEqual(await store.getAllLogs(), []);
  failWrite = false;
  await store.saveLog(feed('pending'));
  await store.saveLog(feed('pending'));
  assert.deepEqual(await store.getAllLogs(), [feed('pending')]);
});

test('a failed read cannot overwrite existing history with an empty list', async () => {
  values.set(logs, 'damaged existing data');
  await assert.rejects(store.saveLog(feed('new')), SyntaxError);
  assert.equal(values.get(logs), 'damaged existing data');
});

test('a queued switch blocks a stale form, and unit changes preserve the selection', async () => {
  const switchBaby = store.saveSettings({ activeBabyId: 'B' });
  const changeUnit = store.saveSettings({ volumeUnit: 'oz' });
  await assert.rejects(store.saveLog(feed('stale', 'A'), { requireActiveBaby: true }), /active baby changed/);
  await Promise.all([switchBaby, changeUnit]);
  assert.deepEqual(await store.getAllLogs(), []);
  await store.saveLog(feed('fresh', 'B'), { requireActiveBaby: true });
  assert.equal((await store.getSettings()).activeBabyId, 'B');
  assert.deepEqual(await store.getLogsForBaby('B'), [feed('fresh', 'B')]);
});

test('a restored running timer includes elapsed wall time and paused time is excluded', async () => {
  const started = await store.setNursingSide('A', null, 'left', 1000);
  const restored = await store.getNursingSession('A');
  assert.deepEqual(restored, started);
  assert.equal(nursingDurations(restored, 301000).leftDuration, 300);
  const paused = await store.setNursingSide('A', restored, null, 301400);
  assert.equal(nursingDurations(paused, 900000).leftDuration, 300);
  const resumed = await store.setNursingSide('A', paused, 'left', 900000);
  const right = await store.setNursingSide('A', resumed, 'right', 900600);
  const timestamp = '2026-11-21T05:00:00Z';
  await store.finishNursing(right, timestamp, 'night feed', 921600);
  assert.deepEqual(await store.getLogsForBaby('A'), [{
    id: started.id, babyId: 'A', type: 'breast', timestamp, notes: 'night feed',
    details: { breast: { leftDuration: 301, rightDuration: 21, lastBreastUsed: 'right' } },
  }]);
  assert.equal(await store.getNursingSession('A'), null);
});

test('babies have independent timers and stale actions cannot overwrite them', async () => {
  const a = await store.setNursingSide('A', null, 'right', 1000);
  await store.saveSettings({ activeBabyId: 'B' });
  assert.equal(await store.getNursingSession('B'), null);
  await assert.rejects(store.finishNursing(a, 'unused'), /active baby changed/);
  await assert.rejects(store.setNursingSide('A', a, null), /active baby changed/);
  const b = await store.setNursingSide('B', null, 'left', 2000);
  const paused = await store.setNursingSide('B', b, null, 5000);
  await assert.rejects(store.setNursingSide('B', b, 'right', 9000), /timer changed/);
  await assert.rejects(store.discardNursing(b), /timer changed/);
  await assert.rejects(store.finishNursing(b, 'unused'), /timer changed/);
  await store.discardNursing(paused);
  assert.equal(await store.getNursingSession('B'), null);
  assert.deepEqual(await store.getNursingSession('A'), a);
  await store.deleteProfile('A');
  assert.equal(await store.getNursingSession('A'), null);
});

test('failed writes are retryable and interrupted cleanup cannot duplicate or revive a feed', async () => {
  const original = await store.setNursingSide('A', null, 'left', 1000);
  const timestamp = '2026-11-21T06:00:00Z';
  failWrite = true;
  await assert.rejects(store.finishNursing(original, timestamp, 'original', 6000), /disk full/);
  assert.deepEqual(await store.getNursingSession('A'), original);
  failWrite = false;
  failRemove = true;
  await store.finishNursing(original, timestamp, 'original', 6000);
  assert.equal(await store.getNursingSession('A'), null);
  failRemove = false;
  assert.equal(await store.getNursingSession('A'), null);
  const next = await store.setNursingSide('A', null, 'right', 9000);
  assert.deepEqual(await store.finishNursing(original, timestamp, 'retry', 12000), next);
  const [log] = await store.getAllLogs();
  assert.equal((await store.getAllLogs()).length, 1);
  assert.equal(log.notes, 'original');
  assert.equal(log.details.breast.leftDuration, 5);
  assert.deepEqual(await store.getNursingSession('A'), next);
  failRemove = true;
  await store.finishNursing(next, timestamp, '', 15000);
  failRemove = false;
  await store.deleteLog(next.id);
  assert.equal(await store.getNursingSession('A'), null);
});
