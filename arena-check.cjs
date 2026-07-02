const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/arena?id=comp-live-1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const metrics = await page.evaluate(() => {
    const arenaPage = document.querySelector('.arena-page');
    const arenaGrid = document.querySelector('.arena-grid');
    const arenaHeader = document.querySelector('.arena-header');
    const rect = (el) => el ? { top: Math.round(el.getBoundingClientRect().top), height: Math.round(el.getBoundingClientRect().height), width: Math.round(el.getBoundingClientRect().width) } : null;
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      bodyH: document.body.scrollHeight,
      arenaPage: rect(arenaPage),
      arenaGrid: rect(arenaGrid),
      arenaHeader: rect(arenaHeader),
      styles: arenaGrid ? { minH: window.getComputedStyle(arenaGrid).minHeight, cols: window.getComputedStyle(arenaGrid).gridTemplateColumns } : null,
    };
  });
  console.log(JSON.stringify(metrics, null, 2));
  await page.screenshot({ path: 'arena-layout.png' });
  await browser.close();
})();
