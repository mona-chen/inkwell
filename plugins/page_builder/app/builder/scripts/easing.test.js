const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/core/easing.js'), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};

test('a curve that is exactly a keyword stays a keyword, anything else becomes a cubic-bezier', async () => {
  const { easingCss, EASING_PRESETS } = await load();
  assert.equal(easingCss([0, 0, 0.58, 1]), 'ease-out');
  assert.equal(easingCss([0, 0, 1, 1]), 'linear');
  assert.equal(easingCss([0.16, 1, 0.3, 1]), 'cubic-bezier(0.16,1,0.3,1)');
  assert.equal(easingCss([0.34, 1.56, 0.64, 1]), 'cubic-bezier(0.34,1.56,0.64,1)');
  assert.equal(easingCss('nonsense'), 'ease');
  // Every preset the editor offers must produce CSS the stylesheet accepts.
  for (const preset of EASING_PRESETS) assert.match(easingCss(preset.points), /^(?:[a-z-]+|cubic-bezier\([\d.,\s-]+\))$/);
});

test('authored easing round-trips through the editor model', async () => {
  const { parseEasing, easingCss, EASING_PRESETS } = await load();
  for (const preset of EASING_PRESETS) {
    const parsed = parseEasing(easingCss(preset.points));
    assert.deepEqual(parsed.points.map((value) => Number(value.toFixed(3))), preset.points.map((value) => Number(value.toFixed(3))), preset.label);
  }
  assert.deepEqual(parseEasing('cubic-bezier(0.16, 1, 0.3, 1)').points, [0.16, 1, 0.3, 1]);
  assert.equal(parseEasing('ease-in-out').kind, 'keyword');
  assert.equal(parseEasing('wobble').kind, 'other', 'an unreadable easing falls back without throwing');
});

test('an easing that would be silently dropped by the stylesheet is refused at the panel', async () => {
  const { validateEasing } = await load();
  assert.equal(validateEasing('cubic-bezier(0.1,0.2,0.3,0.4)'), 'cubic-bezier(0.1,0.2,0.3,0.4)');
  assert.equal(validateEasing('ease-in'), 'ease-in');
  assert.equal(validateEasing('steps(4, end)'), 'steps(4, end)');
  assert.equal(validateEasing('steps(4, jump-both)'), 'steps(4, jump-both)');
  assert.equal(validateEasing('linear(0, 0.5 50%, 1)'), 'linear(0, 0.5 50%, 1)');
  assert.equal(validateEasing('bogus()'), '');
  assert.equal(validateEasing('cubic-bezier(1; }'), '');
  assert.equal(validateEasing('ease; }body{display:none'), '');
});

test('the stylesheet and the panel share one easing grammar', async () => {
  // Two copies of this regex is how an author ends up with an easing the CSS silently drops.
  const root = path.join(__dirname, '../src/core');
  for (const file of ['StyleEngine.js', 'designTokens.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /EASING_CSS_PATTERN/, `${file} must import the shared pattern`);
    assert.doesNotMatch(source, /cubic-bezier\\\(\[\\d/, `${file} must not carry its own copy of the pattern`);
  }
});

test('spring parameters become a legal overshooting curve plus a sensible duration', async () => {
  const { springToBezier, springSettleMs } = await load();
  const bouncy = springToBezier({ stiffness: 300, damping: 10, mass: 1 });
  assert.equal(bouncy.length, 4);
  assert.ok(bouncy[1] > 1, 'a low-damping spring overshoots in the curve');
  assert.ok(bouncy[0] >= 0 && bouncy[0] <= 1 && bouncy[2] >= 0 && bouncy[2] <= 1, 'control points stay inside the time axis');
  const stiff = springToBezier({ stiffness: 400, damping: 40, mass: 1 });
  assert.deepEqual(stiff, [0.22, 1, 0.36, 1], 'a critically damped spring is a plain ease-out');
  assert.ok(springSettleMs({ stiffness: 300, damping: 10 }) > springSettleMs({ stiffness: 400, damping: 40 }), 'a slower spring suggests a longer duration');
  for (const spring of [{}, { stiffness: 0, damping: 0, mass: 0 }, { stiffness: 900, damping: 5, mass: 4 }]) {
    const points = springToBezier(spring);
    assert.ok(points.every((value) => Number.isFinite(value)));
    assert.ok(springSettleMs(spring) >= 80 && springSettleMs(spring) <= 4000);
  }
});

test('the curve is evaluated the way the browser will, so the preview cannot lie', async () => {
  const { bezierValueAt, bezierPath } = await load();
  assert.equal(bezierValueAt([0, 0, 1, 1], 0), 0);
  assert.equal(bezierValueAt([0, 0, 1, 1], 1), 1);
  assert.equal(Number(bezierValueAt([0, 0, 1, 1], 0.5).toFixed(2)), 0.5, 'a linear curve is even');
  assert.ok(bezierValueAt([0.34, 1.56, 0.64, 1], 0.4) > 1, 'an overshooting curve passes its target mid-flight');
  const drawn = bezierPath([0.16, 1, 0.3, 1]);
  assert.match(drawn.path, /^M[\d.]+ [\d.]+ L/);
  assert.equal(drawn.path.split('L').length, 49, 'the path is sampled densely enough to look smooth');
  for (const point of [drawn.handle1, drawn.handle2, drawn.origin, drawn.end]) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
});
