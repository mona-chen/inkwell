const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// valueInput.js is dependency-free ESM, so it can be imported from source without a bundler.
const load = async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/core/valueInput.js'), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};

test('a numeric field accepts arithmetic instead of rejecting typed maths', async () => {
  const { evaluateExpression } = await load();
  assert.equal(evaluateExpression('12*2'), 24);
  assert.equal(evaluateExpression('(4+2)*3'), 18);
  assert.equal(evaluateExpression('100 / 4'), 25);
  assert.equal(evaluateExpression('=10+5'), 15);
  assert.equal(evaluateExpression('-8'), -8);
  assert.equal(evaluateExpression('  240  '), 240);
});

test('percentages are relative to the current value, like the design tools people know', async () => {
  const { evaluateExpression } = await load();
  assert.equal(evaluateExpression('100%', { current: 240 }), 240);
  assert.equal(evaluateExpression('50%', { current: 240 }), 120);
  assert.equal(evaluateExpression('100% - 20', { current: 240 }), 220);
  assert.equal(evaluateExpression('50%', {}), 0.5, 'without a reference a percentage is a plain ratio');
});

test('unusable maths is rejected instead of committing NaN', async () => {
  const { evaluateExpression } = await load();
  for (const text of ['', '   ', 'min(2, 3)', '1/0', '12px', 'hello', '10 +', '(2', '2)']) {
    assert.equal(evaluateExpression(text), null, `${JSON.stringify(text)} must not evaluate`);
  }
});

test('typing a unit sets the unit, and an unknown unit is refused', async () => {
  const { parseValueInput } = await load();
  assert.deepEqual(parseValueInput('24rem', { units: ['px', 'rem', '%'] }), { size: 24, unit: 'rem' });
  assert.deepEqual(parseValueInput('50%', { units: ['px', '%'] }), { size: 50, unit: '%' });
  assert.deepEqual(parseValueInput('12*2px'), { size: 24, unit: 'px' });
  assert.deepEqual(parseValueInput('100% - 20', { current: 240, units: ['px'] }), { size: 220, unit: 'px' });
  assert.deepEqual(parseValueInput('auto'), { size: 'auto', unit: '' });
  assert.equal(parseValueInput('12foo'), null);
  assert.equal(parseValueInput('12px px'), null);
  assert.equal(parseValueInput(''), null, 'an empty field is the caller\'s decision, never a silent zero');
});

test('arrow keys step on the control grid with a fine and a coarse modifier', async () => {
  const { stepValue } = await load();
  assert.equal(stepValue(10, { step: 5, direction: 1 }), 15);
  assert.equal(stepValue(10, { step: 5, direction: -1 }), 5);
  assert.equal(stepValue(10, { step: 5, direction: 1, shift: true }), 60);
  assert.equal(stepValue(10, { step: 5, direction: -1, alt: true }), 9.5);
  assert.equal(stepValue(98, { step: 5, direction: 1, max: 100 }), 100, 'stepping respects the control range');
});

test('out-of-range values are corrected with a reason the panel can show', async () => {
  const { clampValue } = await load();
  assert.deepEqual(clampValue(4, { min: 0, max: 100 }), { value: 4, clamped: false, reason: '' });
  const clamped = clampValue(180, { min: 0, max: 100 });
  assert.equal(clamped.value, 100);
  assert.equal(clamped.clamped, true);
  assert.match(clamped.reason, /Highest allowed value is 100/);
});

test('a drag scrubs on the same grid as the arrow keys, without float noise', async () => {
  const { scrubDelta } = await load();
  assert.equal(scrubDelta(100, 0, 40, { step: 1 }), 120);
  assert.equal(scrubDelta(100, 0, -40, { step: 1 }), 80);
  assert.equal(scrubDelta(100, 0, 40, { step: 1, shift: true }), 300);
  assert.equal(scrubDelta(100, 0, 10, { step: 1, alt: true }), 100.5);
  assert.equal(scrubDelta(95, 0, 80, { step: 1, max: 100 }), 100);
});
