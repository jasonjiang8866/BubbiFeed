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
