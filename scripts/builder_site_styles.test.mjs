import assert from 'node:assert/strict';
import test from 'node:test';
import StyleEngine from '../plugins/page_builder/app/builder/src/core/StyleEngine.js';

const compile = (theme = {}) => new StyleEngine().compile({ data: { settings: { theme }, children: [] }, walk() {} });

test('Builder pages inherit site defaults with safe standalone fallbacks', () => {
  const css = compile();
  assert.match(css, /--ink-color-primary:var\(--ink-site-color-primary,#6750ff\)/);
  assert.match(css, /font-size:var\(--ink-site-base-size,16px\)/);
  assert.match(css, /--ink-page-gutter:var\(--ink-site-page-gutter,10px\)/);
});

test('Explicit page styles override inherited values, including zero spacing', () => {
  const css = compile({ colors: { primary: '#123abc' }, typography: { baseSize: 20 }, spacing: { pageGutter: 0, sectionGap: 0 } });
  assert.match(css, /--ink-color-primary:#123abc/);
  assert.match(css, /font-size:20px/);
  assert.match(css, /--ink-page-gutter:0px/);
  assert.match(css, /--ink-section-gap:0px/);
  assert.match(css, /--ink-color-secondary:var\(--ink-site-color-secondary/);
});
