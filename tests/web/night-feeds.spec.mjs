import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Asia/Singapore' });

test('a late-night bottle belongs to yesterday in history, home and weekly totals', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-27T00:10:00+08:00'));
  await page.goto('/');
  const text = name => page.getByText(name, { exact: true }).filter({ visible: true });
  await text('Log Feed').click();
  await text('BOTTLE').click();
  await text('90 ml').click();
  await page.getByRole('button', { name: 'Change feeding time' }).click();
  const clock = page.getByRole('textbox', { name: 'Feeding time in 24-hour format' });
  await clock.fill('23:50');
  await text('SAVE FEEDING SESSION').click();
  await expect(text('Check feeding time')).toBeVisible();
  await page.getByRole('button', { name: 'Yesterday' }).click();
  await expect(page.getByText(/Nov.*26.*2026|26.*Nov.*2026/)).toBeVisible();
  await text('SAVE FEEDING SESSION').click();
  await expect(text('Feeding logged')).toBeVisible();
  await text('History').click();
  await expect(text('Yesterday')).toBeVisible();
  await expect(text('90 ml')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('@feedmybaby_logs_v1')));
  expect(saved).toHaveLength(1);
  expect(saved[0].timestamp).toBe('2026-11-26T15:50:00.000Z');
  await text('Home').click();
  await expect(text('0 ml')).toBeVisible();
  await text('Insights').click();
  await expect(text('Total bottle volume').locator('..')).toContainText('90 ml');
  await expect(text('Bottle Feedings').locator('..')).toContainText('1');
});

test('correcting a bottle keeps its identity, retries in place and survives relaunch', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-27T00:10:00+08:00'));
  await page.addInitScript(() => {
    if (localStorage.getItem('@feedmybaby_profiles_v1')) return;
    const profiles = ['Aster', 'Basil'].map(id => ({ id, name: id, gender: 'other', birthDate: '2026-06-01', birthWeight: 3200 }));
    const bottle = (id, babyId, amount, timestamp) => ({ id, babyId, type: 'bottle', timestamp, details: { bottle: { amount, bottleType: 'breastmilk' } } });
    localStorage.setItem('@feedmybaby_profiles_v1', JSON.stringify(profiles));
    localStorage.setItem('@feedmybaby_settings_v1', JSON.stringify({ activeBabyId: 'Aster', volumeUnit: 'ml' }));
    localStorage.setItem('@feedmybaby_logs_v1', JSON.stringify([
      bottle('night', 'Aster', 120, '2026-11-26T15:50:00.000Z'),
      bottle('today', 'Aster', 90, '2026-11-26T16:05:00.000Z'),
      bottle('other', 'Basil', 60, '2026-11-26T15:45:00.000Z'),
    ]));
  });
  await page.goto('/');
  const text = name => page.getByText(name, { exact: true }).filter({visible: true});
  const button = name => page.getByRole('button', { name });
  await text('Insights').click();
  await expect(text('Total bottle volume').locator('..')).toContainText('210 ml');
  await text('History').click();
  await button(/^Edit bottle 120 ml/).click();
  const amount = page.getByRole('textbox', { name: 'Bottle volume in ml' });
  await amount.fill('90');
  await button('Change feeding time').click();
  await page.getByRole('textbox', { name: 'Feeding time in 24-hour format' }).fill('23:40');
  await page.getByRole('textbox', { name: 'Bottle notes' }).fill('Corrected overnight');
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === '@feedmybaby_logs_v1') {
        Storage.prototype.setItem = write;
        throw new Error('write interrupted');
      }
      return write.call(this, key, value);
    };
  });
  await button('Save changes').click();
  await expect(text('write interrupted')).toBeVisible();
  await expect(amount).toHaveValue('90');
  await button('Save changes').click();
  await expect(text('Bottle updated')).toBeVisible();
  await page.goto('/');
  await text('History').click();
  await expect(text('Yesterday')).toBeVisible();
  await expect(button(/^Edit bottle 90 ml/)).toHaveCount(2);
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem('@feedmybaby_logs_v1')));
  expect(logs).toHaveLength(3);
  expect(logs.find(x => x.id === 'night')).toMatchObject({ babyId: 'Aster', notes: 'Corrected overnight',
    timestamp: '2026-11-26T15:40:00.000Z', details: { bottle: { amount: 90, bottleType: 'breastmilk' } } });
  expect(logs.find(x => x.id === 'other')).toMatchObject({ babyId: 'Basil', details: { bottle: { amount: 60 } } });
  await text('Insights').click();
  await expect(text('Total bottle volume').locator('..')).toContainText('180 ml');
  await expect(text('Bottle Feedings').locator('..')).toHaveText('Bottle Feedings2');
});
