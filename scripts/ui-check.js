/**
 * Visual verification of the 3 fixed bugs at iPhone 16/17/18 size (393x852).
 * Seeds AsyncStorage (localStorage on web) with a profile + a recent bottle log,
 * then captures / (home), /logger (bottle tab), /settings.
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8081';
const OUT = path.join(__dirname, 'ui-check');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// --- Seed data (mirrors storage.ts keys) ---
const babyId = 'baby-test-1';
const profiles = [
  {
    id: babyId,
    name: 'Little Sweetheart', // long name to exercise the ACTIVE-pill fix
    birthDate: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
    gender: 'girl',
    birthWeight: 3200,
  },
];
const logs = [
  {
    id: 'log-test-1',
    babyId,
    type: 'bottle',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    notes: '',
    details: { bottle: { amount: 120, bottleType: 'formula' } },
  },
];
const settings = { activeBabyId: babyId, volumeUnit: 'ml', isDarkMode: false };

const SEED = {
  '@feedmybaby_profiles_v1': JSON.stringify(profiles),
  '@feedmybaby_logs_v1': JSON.stringify(logs),
  '@feedmybaby_settings_v1': JSON.stringify(settings),
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=393,852'],
  });

  const page = await browser.newPage();

  // iPhone 16 / 17 / 18 logical size: 393x852 @ 3x
  await page.setViewport({
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  // Seed localStorage BEFORE app load (AsyncStorage on web = localStorage)
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((seed) => {
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, SEED);

  const shots = [
    { name: 'home', url: '/', wait: 3500 },
    { name: 'logger-bottle', url: '/logger', wait: 3500 },
    { name: 'settings', url: '/settings', wait: 3500 },
  ];

  for (const s of shots) {
    await page.goto(BASE + s.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, s.wait)); // let AsyncStorage load + render

    // On /logger, click the Bottle tab with a REAL mouse click (RN Web Pressable
    // needs genuine pointer events, not synthetic dispatchEvent)
    if (s.name === 'logger-bottle') {
      const rect = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('*'));
        const el = els.find((n) => {
          const t = (n.textContent || '').trim().toLowerCase();
          return t === 'bottle' && n.children.length === 0;
        });
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      console.log('Bottle tab rect:', JSON.stringify(rect));
      if (rect) {
        await page.mouse.click(rect.x, rect.y);
        await new Promise((r) => setTimeout(r, 2500));
      }
    }

    await page.screenshot({ path: path.join(OUT, `${s.name}.png`), fullPage: false });
    console.log(`Captured ${s.name}.png`);
  }

  await browser.close();
  console.log('Done. Screenshots in scripts/ui-check/');
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
