import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Asia/Singapore' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-28T00:10:00+08:00'));
  await page.addInitScript(() => {
    if (localStorage.getItem('@feedmybaby_profiles_v1')) return;
    const profiles = ['Aster', 'Basil'].map(id => ({ id, name: id, gender: 'other', birthDate: '2026-06-01', birthWeight: 3200 }));
    localStorage.setItem('@feedmybaby_profiles_v1', JSON.stringify(profiles));
    localStorage.setItem('@feedmybaby_settings_v1', JSON.stringify({ activeBabyId: 'Aster', volumeUnit: 'ml' }));
    localStorage.setItem('@feedmybaby_logs_v1', JSON.stringify([
      { id: 'yesterday', babyId: 'Aster', timestamp: '2026-11-27T23:50:00+08:00', type: 'bottle',
        notes: 'Private note', details: { bottle: { amount: 120, bottleType: 'formula' } } },
    ]));
  });
});

test('opens a fresh snapshot; share cancellation, retry and switching profiles keep the right text', async ({ page }) => {
  await page.addInitScript(() => {
    window.shared = [];
    Object.defineProperty(navigator, 'share', { value: async ({ text }) => {
      window.shared.push(text);
      if (window.shared.length === 1) throw new DOMException('Cancelled', 'AbortError');
    } });
  });
  await page.goto('/');
  const button = name => page.getByRole('button', { name, exact: true });
  await button('Care handoff').waitFor();
  // Simulate a completed correction after the Home screen loaded.
  await page.evaluate(() => {
    const key = '@feedmybaby_logs_v1';
    const feeds = JSON.parse(localStorage.getItem(key));
    feeds.push({ ...feeds[0], id: 'today', timestamp: '2026-11-28T00:05:00+08:00',
      details: { bottle: { amount: 90, bottleType: 'breastmilk' } } });
    localStorage.setItem(key, JSON.stringify(feeds));
  });
  await button('Care handoff').click();
  await expect(page.getByRole('heading', { name: 'Care handoff for Aster' })).toBeVisible();
  await expect(page.getByText('1 bottle · 90 ml', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.shared)).toEqual([]);
  await button('Share handoff').click();
  await button('Share handoff').click();
  const [first, second] = await page.evaluate(() => window.shared);
  expect(first).toBe(second);
  expect(first).toContain('Bottle · 90 ml · Breast milk');
  expect(first).toContain('Bottle · 120 ml · Formula');
  expect(first).not.toContain('Private note');
  await button('Close handoff').click();
  await page.getByText('Switch to Basil', { exact: true }).click();
  await expect(page.getByText('Switch to Aster', { exact: true })).toBeVisible();
  await button('Care handoff').click();
  await expect(page.getByRole('heading', { name: 'Care handoff for Basil' })).toBeVisible();
  await expect(page.getByText('No feeds recorded yet.', { exact: true })).toBeVisible();
  await button('Share handoff').click();
  expect((await page.evaluate(() => window.shared)).at(-1)).not.toMatch(/Aster|120 ml|90 ml/);
});

test('copy fallback preserves the preview after a failed clipboard write', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => {
      if (!window.clipboardTried) { window.clipboardTried = true; throw new Error('denied'); }
      window.copied = text;
    } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Care handoff', exact: true }).click();
  const copy = page.getByRole('button', { name: 'Copy handoff' });
  await copy.click();
  await expect(page.getByText(/Could not share/)).toBeVisible();
  await copy.click();
  await expect(page.getByText('Summary copied.')).toBeVisible();
  expect(await page.evaluate(() => window.copied)).toContain('Care handoff for Aster');
});
