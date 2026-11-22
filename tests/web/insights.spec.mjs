import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Asia/Singapore' });

test('weekly totals survive adding solids, switch with the baby and roll over at local midnight', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-22T23:58:00+08:00') });
  await page.addInitScript(() => {
    if (localStorage.getItem('@feedmybaby_profiles_v1')) return;
    const profiles = ['Aster', 'Basil'].map(id => ({
      id, name: id, birthDate: '2026-06-01', gender: 'other', birthWeight: 3200,
    }));
    const bottle = (id, babyId, timestamp, amount) => ({
      id, babyId, timestamp, type: 'bottle', details: { bottle: { amount, bottleType: 'formula' } },
    });
    const logs = [
      bottle('older', 'Aster', '2026-11-14T10:00:00+08:00', 150),
      bottle('yesterday', 'Aster', '2026-11-21T23:50:00+08:00', 120),
      bottle('today', 'Aster', '2026-11-22T00:10:00+08:00', 90),
      bottle('basil', 'Basil', '2026-11-16T00:01:00+08:00', 60),
      { id: 'nursing', babyId: 'Aster', type: 'breast', timestamp: '2026-11-20T12:00:00+08:00',
        details: { breast: { leftDuration: 180, rightDuration: 240, lastBreastUsed: 'right' } } },
      { id: 'solid', babyId: 'Aster', type: 'solid', timestamp: '2026-11-19T12:00:00+08:00',
        details: { solid: { foodDescription: 'Rice', amountCategory: 'few_bites' } } },
    ];
    localStorage.setItem('@feedmybaby_profiles_v1', JSON.stringify(profiles));
    localStorage.setItem('@feedmybaby_settings_v1', JSON.stringify({ activeBabyId: 'Aster', volumeUnit: 'ml', isDarkMode: false }));
    localStorage.setItem('@feedmybaby_logs_v1', JSON.stringify(logs));
  });

  await page.goto('/');
  const tab = name => page.getByText(name, { exact: true });
  const countFor = label => tab(label).locator('..');
  const total = () => tab('Total bottle volume').locator('..');
  const interval = tab('Average time between recorded feeds');
  await tab('Insights').click();
  await expect(page.getByText('Last 7 days for Aster')).toBeVisible();
  await expect(total()).toContainText('210 ml');
  await expect(countFor('Bottle Feedings')).toHaveText('Bottle Feedings2');
  await expect(countFor('Total nursing time')).toContainText('7 min');
  const chart = countFor('Daily bottle volume');
  await expect(chart.getByText('Sat', { exact: true }).locator('..')).toContainText('120 ml');
  await expect(chart.getByText('Sun', { exact: true }).locator('..')).toContainText('90 ml');
  await expect(interval).toBeVisible();
  await tab('Log Feed').click();
  await tab('SOLID').click();
  await tab('Oatmeal').click();
  await tab('SAVE FEEDING SESSION').click();
  await expect(tab('Feeding logged')).toBeVisible();
  await tab('Insights').click();
  await expect(total()).toContainText('210 ml');
  await expect(countFor('Solid Feedings')).toHaveText('Solid Feedings2');

  await tab('Home').click();
  await tab('Switch to Basil').click();
  await expect(tab('Switch to Aster')).toBeVisible();
  await tab('Insights').click();
  await expect(page.getByText('Last 7 days for Basil')).toBeVisible();
  await expect(total()).toContainText('60 ml');
  await expect(countFor('Bottle Feedings')).toHaveText('Bottle Feedings1');
  await expect(interval).toHaveCount(0);
  await expect(tab('Hungry Now')).toHaveCount(0);
  await page.clock.fastForward('02:01');
  await expect(total()).toContainText('0 ml');
  await expect(tab('No bottles recorded in the last 7 days.')).toBeVisible();
});
