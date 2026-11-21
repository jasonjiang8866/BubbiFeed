import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { beforeEach, test } from 'node:test';

const values = new Map();
const profiles = '@feedmybaby_profiles_v1';
const logs = '@feedmybaby_logs_v1';
let failWrite = false;
globalThis.testStorage = {
  async getItem(key) { return values.get(key) ?? null; },
  async setItem(key, value) {
    if (failWrite) throw new Error('disk full');
    values.set(key, value);
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
const { StorageService: store } = await import('../src/utils/storage.ts');
const feed = (id, babyId = 'A') => ({
  id, babyId, timestamp: '2026-11-21T04:00:00Z', type: 'bottle',
  details: { bottle: { amount: 120, bottleType: 'formula' } },
});
beforeEach(async () => {
  values.clear();
  failWrite = false;
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
