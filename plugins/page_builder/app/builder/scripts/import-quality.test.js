const { test } = require('node:test');
const assert = require('node:assert/strict');
const { importQuality, skippedRoutes } = require('./import-quality');

test('DOM conversion never implies behavioral parity', () => {
  const report = importQuality([{ type: 'container', settings: { importedDom: true }, children: [
    { type: 'button', settings: { importedTag: 'button', motion: { trigger: 'hover' } } },
  ] }], [{ animations: [{}, {}] }]);
  assert.equal(report.behaviorVerified, false);
  assert.equal(report.maxDepth, 2);
  assert.equal(report.unverifiedControls, 1);
  assert.equal(report.nativeMotionNodes, 1);
  assert.equal(report.observedAnimations, 2);
});

test('reports external CMS articles separately from captured and missing internal routes', () => {
  const manifest = { source: 'https://ruut.chat', pages: [{ url: 'https://ruut.chat/' }, { url: 'https://ruut.chat/blogs.html' }] };
  const pages = [{ source: manifest.source, viewports: [{ links: ['https://ruut.chat/index.html#hero', 'https://ruut.chat/blogs.html', 'https://ruutai.framer.ai/blogs/article', 'https://ruut.chat/about.html', 'mailto:hi@ruut.chat'] }, { links: ['https://ruutai.framer.ai/blogs/article'] }] }];
  const skipped = skippedRoutes(manifest, pages);
  assert.equal(skipped.length, 2);
  assert.match(skipped[0].reason, /Outside/);
  assert.match(skipped[1].reason, /Not captured/);
});

test('reports sitemap-only omissions and counts captured aliases as covered', () => {
  const manifest = {
    source: 'https://site.test/', pages: [{ url: 'https://site.test/' }],
    aliases: [{ url: 'https://site.test/home', target: 'https://site.test/' }],
    sitemapDiscovery: { urls: ['https://site.test/', 'https://site.test/home', 'https://site.test/legal/privacy'] }
  };
  const skipped = skippedRoutes(manifest, []);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].url, 'https://site.test/legal/privacy');
  assert.match(skipped[0].reason, /Not captured/);
});
