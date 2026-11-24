import { expect, test } from '@playwright/test';

const logsKey = '@feedmybaby_logs_v1';

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(() => {
    if (localStorage.getItem('@feedmybaby_profiles_v1')) return;
    const profiles = ['Aster', 'Basil'].map(name => ({
      id: name, name, birthDate: '2026-06-01', gender: 'other', birthWeight: 3200,
    }));
    const entry = {
      id: 'legacy', babyId: 'Aster', type: 'bottle', timestamp: new Date().toISOString(),
      details: { bottle: { amount: 210, bottleType: 'formula' } },
    };
    localStorage.setItem('@feedmybaby_profiles_v1', JSON.stringify(profiles));
    localStorage.setItem('@feedmybaby_logs_v1', JSON.stringify([entry]));
    localStorage.setItem('@feedmybaby_settings_v1', JSON.stringify({ activeBabyId: 'Aster', volumeUnit: 'ml', isDarkMode: false }));
  });
  await page.goto('/');
  await expect(page.getByText('Switch to Basil')).toBeVisible();
});

test('switching baby refreshes totals and the retained logger saves under the displayed baby', async ({ page }) => {
  await page.getByText('Log Feed', { exact: true }).click();
  await expect(page.getByText('Recording for: Aster')).toBeVisible();
  const notes = page.getByPlaceholder('Spit up slightly, very hungry, fell asleep...');
  await notes.fill('Aster draft');
  await page.getByText('Home', { exact: true }).click();
  await page.getByText('Switch to Basil').click();
  await expect(page.getByText('No feeds logged', { exact: true })).toBeVisible();
  await expect(page.getByText('0 ml', { exact: true })).toBeVisible();
  await page.getByText('Log Feed', { exact: true }).click();
  await expect(page.getByText('Recording for: Basil')).toBeVisible();
  await expect(notes).toHaveValue('');
  await page.getByText('BOTTLE', { exact: true }).click();
  await page.getByText('SAVE FEEDING SESSION').click();
  await expect(page.getByText('Feeding logged', { exact: true })).toBeVisible();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), logsKey);
  expect(saved.map(entry => entry.babyId)).toEqual(['Aster', 'Basil']);
});

test('failed writes show an error, preserve the draft, and retry saves once', async ({ page }) => {
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new Error('simulated storage failure');
      return original.call(this, name, value);
    };
    window.restoreWrites = () => { Storage.prototype.setItem = original; };
  }, logsKey);
  await page.getByText('90 ml', { exact: true }).click();
  await expect(page.getByText('Feeding not saved', { exact: true })).toBeVisible();
  await expect(page.getByText('Feeding logged', { exact: true })).toHaveCount(0);
  await page.getByText('Log Feed', { exact: true }).click();
  await page.getByText('BOTTLE', { exact: true }).click();
  const notes = page.getByPlaceholder('Spit up slightly, very hungry, fell asleep...');
  await notes.fill('Keep this entry');
  await page.getByText('SAVE FEEDING SESSION').click();
  await expect(page.getByText(/Your entry is still here/)).toBeVisible();
  await expect(notes).toHaveValue('Keep this entry');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, logsKey)).toBe(1);
  await page.evaluate(() => window.restoreWrites());
  await page.getByText('SAVE FEEDING SESSION').click();
  await expect(page.getByText('Feeding logged', { exact: true })).toBeVisible();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), logsKey);
  expect(saved).toHaveLength(2);
  expect(saved[1].notes).toBe('Keep this entry');
});

test('a form open in another tab cannot save after the active baby changes', async ({ context, page }) => {
  await page.getByText('Log Feed', { exact: true }).click();
  await expect(page.getByText('Recording for: Aster')).toBeVisible();
  await page.getByText('BOTTLE', { exact: true }).click();
  const other = await context.newPage();
  await other.goto('/');
  await other.getByText('Switch to Basil').click();
  await expect(other.getByText('Switch to Aster')).toBeVisible();
  await page.getByText('SAVE FEEDING SESSION').click();
  await expect(page.getByText('Feeding not saved', { exact: true })).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, logsKey)).toBe(1);
});

test('a nursing timer survives closing the app, stays with its baby and saves both sides once', async ({ context, page }) => {
  await page.clock.setFixedTime(new Date('2026-11-21T05:00:00Z'));
  await page.getByText('Log Feed', { exact: true }).click();
  await page.getByRole('button', { name: 'Start left timer' }).click();
  await expect(page.getByRole('button', { name: 'Pause left timer' })).toBeVisible();
  await page.close();

  const reopened = await context.newPage();
  await reopened.clock.setFixedTime(new Date('2026-11-21T05:08:00Z'));
  await reopened.goto('/');
  const continueA = reopened.getByRole('button', { name: 'Continue nursing for Aster' });
  await expect(continueA).toContainText('Running · Left side · 08:00');
  await reopened.getByText('Switch to Basil').click();
  await expect(reopened.getByText('Switch to Aster')).toBeVisible();
  await expect(continueA).toHaveCount(0);
  await reopened.getByText('Log Feed', { exact: true }).click();
  await expect(reopened.getByText('Recording for: Basil')).toBeVisible();
  await expect(reopened.getByText('00:00', { exact: true })).toHaveCount(2);
  await reopened.getByText('SAVE FEEDING SESSION').click();
  await expect(reopened.getByText('Start a nursing timer first')).toBeVisible();
  await reopened.getByText('Home', { exact: true }).click();
  await reopened.getByText('Switch to Aster').click();
  await continueA.click();
  await expect(reopened.getByText('Recording for: Aster')).toBeVisible();
  await reopened.getByRole('button', { name: 'Pause left timer' }).click();
  await expect(reopened.getByRole('button', { name: 'Start left timer' })).toBeVisible();
  await reopened.getByText('BOTTLE', { exact: true }).click();
  await reopened.getByText('Home', { exact: true }).click();
  await expect(continueA).toContainText('Paused · Left side · 08:00');
  await reopened.clock.setFixedTime(new Date('2026-11-21T05:10:00Z'));
  await continueA.click();
  await reopened.getByRole('button', { name: 'Start right timer' }).click();
  await expect(reopened.getByRole('button', { name: 'Pause right timer' })).toBeVisible();
  await reopened.clock.setFixedTime(new Date('2026-11-21T05:10:30Z'));
  await reopened.getByText('SAVE FEEDING SESSION').click();
  await expect(reopened.getByText('Feeding logged', { exact: true })).toBeVisible();
  await reopened.getByText('Home', { exact: true }).click();
  await expect(continueA).toHaveCount(0);
  const logs = await reopened.evaluate(key => JSON.parse(localStorage.getItem(key)), logsKey);
  expect(logs).toHaveLength(2);
  expect(logs[1]).toMatchObject({
    babyId: 'Aster', type: 'breast', details: { breast: { leftDuration: 480, rightDuration: 30, lastBreastUsed: 'right' } },
  });
});

test('manual nursing pauses the live timer and records a separate entry', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-21T05:00:00Z'));
  await page.getByText('Log Feed', { exact: true }).click();
  await page.getByRole('button', { name: 'Start left timer' }).click();
  await expect(page.getByRole('button', { name: 'Pause left timer' })).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-21T05:01:00Z'));
  await page.getByText('MANUAL INPUT').click();
  await page.getByPlaceholder('0', { exact: true }).last().fill('2');
  await page.getByText('RIGHT SIDE', { exact: true }).click();
  await page.getByText('SAVE FEEDING SESSION').click();
  await expect(page.getByText('Feeding logged', { exact: true })).toBeVisible();
  await page.getByText('Home', { exact: true }).click();
  const card = page.getByRole('button', { name: 'Continue nursing for Aster' });
  await expect(card).toContainText('Paused · Left side · 01:00');
  await card.click();
  await page.getByRole('button', { name: 'Discard timer', exact: true }).click();
  await page.getByRole('button', { name: 'Keep timer' }).click();
  await expect(page.getByText('01:00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Discard timer', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm discard' }).click();
  await expect(page.getByText('00:00', { exact: true })).toHaveCount(2);
  await page.getByText('Home', { exact: true }).click();
  await expect(card).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), logsKey);
  expect(saved).toHaveLength(2);
  expect(saved[1].details.breast).toEqual({ leftDuration: 0, rightDuration: 120, lastBreastUsed: 'right' });
});

test('retrying a partially saved profile keeps the same baby and activates it', async ({ page }) => {
  await page.getByText('Settings', { exact: true }).click();
  await page.getByText('Add Baby', { exact: true }).click();
  const name = page.getByPlaceholder('e.g. Liam, Emma');
  await name.fill('Clover');

  // The profile write succeeds, then persistence of the active selection fails once.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === '@feedmybaby_settings_v1') {
        Storage.prototype.setItem = original;
        throw new Error('simulated settings write failure');
      }
      return original.call(this, key, value);
    };
  });
  const save = page.getByText('Save Baby', { exact: true });
  await save.click();
  await expect(page.getByText('Profile not saved', { exact: true })).toBeVisible();
  await expect(name).toHaveValue('Clover');
  const partialId = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('@feedmybaby_profiles_v1')).find(baby => baby.name === 'Clover')?.id);
  expect(partialId).toBeTruthy();

  await save.click();
  await expect(page.getByRole('button', { name: 'Edit Clover' })).toHaveCount(1);
  await page.goto('/');
  await expect(page.getByText('Clover', { exact: true })).toBeVisible();
  await page.getByText('Settings', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Clover' })).toHaveCount(1);
  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem('@feedmybaby_settings_v1')).activeBabyId)).toBe(partialId);
});
