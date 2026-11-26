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
