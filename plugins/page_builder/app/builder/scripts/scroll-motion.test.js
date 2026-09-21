const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('scroll motion follows the section, is reversible, and leaves Design/reduced-motion stable', async () => {
  const puppeteer = (await import('puppeteer-core')).default;
  const source = fs.readFileSync(path.join(__dirname, '../src/core/scrollMotionRuntime.js'), 'utf8');
  const { SCROLL_MOTION_RUNTIME } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    await page.setContent('<body class="ink-builder-design"><div style="height:800px"></div><section style="height:600px"><div id="target">Editable child</div></section><div style="height:1000px"></div></body>');
    await page.$eval('#target', (el) => el.dataset.inkScrollMotion = JSON.stringify({ trigger: 'scroll', duration: 1000, easing: 'linear', keyframes: [{ transform: 'translateX(0px)' }, { transform: 'translateX(240px)' }] }));
    await page.addScriptTag({ content: SCROLL_MOTION_RUNTIME });
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.evaluate(() => document.body.classList.remove('ink-builder-design'));
    await page.waitForFunction(() => document.getAnimations().length === 1);
    await page.evaluate(() => scrollTo(0, 500));
    await page.waitForFunction(() => document.getAnimations()[0].currentTime > 100);
    const first = await page.evaluate(() => document.getAnimations()[0].currentTime);
    await page.evaluate(() => scrollTo(0, 1000));
    await page.waitForFunction((previous) => document.getAnimations()[0].currentTime > previous, {}, first);
    await page.evaluate(() => scrollTo(0, 500));
    await page.waitForFunction((previous) => Math.abs(document.getAnimations()[0].currentTime - previous) < 1, {}, first);
    await page.evaluate(() => document.body.classList.add('ink-builder-design'));
    await page.waitForFunction(() => document.getAnimations().length === 0);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluate(() => document.body.classList.remove('ink-builder-design'));
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.waitForFunction(() => document.getAnimations().length === 1);
    await page.$eval('#target', (el) => el.remove());
    await page.waitForFunction(() => document.getAnimations().length === 0);
  } finally { await browser.close(); }
});
