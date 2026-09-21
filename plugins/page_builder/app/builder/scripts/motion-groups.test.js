const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// motionGroups.js imports the shared easing grammar. A data: URL cannot resolve a relative
// specifier, so the import is rewritten to the real module as its own data: URL — the test still
// exercises the source of truth rather than a copy of the pattern.
const asDataUrl = (file) => 'data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.join(__dirname, '../src/core/', file), 'utf8')).toString('base64');
const load = async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/core/motionGroups.js'), 'utf8')
    .replaceAll("'./easing.js'", JSON.stringify(asDataUrl('easing.js')));
  return import(asDataUrl('easing.js')).then(() => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')));
};

const card = (id, motion) => ({ id, type: 'container', settings: motion ? { motion } : {}, children: [] });
const keyframes = [{ offset: 0, opacity: 0 }, { offset: 1, opacity: 1 }];

test('a group is normalized, defaults dropped, and rejects non-objects', async () => {
  const { normalizeMotionGroup } = await load();
  assert.equal(normalizeMotionGroup(null), null);
  assert.equal(normalizeMotionGroup('nope'), null);
  const group = normalizeMotionGroup({ kind: 'stagger', trigger: 'enter', stagger: -40, duration: '700', iterations: 1, easing: 'cubic-bezier(.16,1,.3,1)', label: '  Card   deck  ' });
  assert.deepEqual(group, { kind: 'stagger', trigger: 'enter', label: 'Card deck', duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' });
  assert.deepEqual(normalizeMotionGroup({ kind: 'bogus', trigger: 'bogus' }), { kind: 'group', trigger: 'inherit' });
  assert.deepEqual(normalizeMotionGroup({ trigger: 'scroll', pin: { enabled: true, distance: 900 } }).pin, { enabled: true, distance: 400 });
  assert.equal(normalizeMotionGroup({ easing: 'javascript:alert(1)' }).easing, undefined);
});

test('a group contributes its trigger, timing and stagger without touching the child keyframes', async () => {
  const { effectiveMotion } = await load();
  const group = { kind: 'unfold', trigger: 'hover', stagger: 100, duration: 500, easing: 'linear' };
  const resolved = effectiveMotion({ enabled: true, trigger: 'load', duration: 900, delay: 40, easing: 'ease', iterations: 3, direction: 'alternate', keyframes }, group, 2);
  assert.equal(resolved.trigger, 'hover', 'the group owns the shared trigger');
  assert.equal(resolved.duration, 500, 'the group timing wins');
  assert.equal(resolved.easing, 'linear');
  assert.equal(resolved.delay, 240, 'child delay + index * stagger');
  assert.equal(resolved.groupTrigger, 'hover');
  assert.deepEqual(resolved.keyframes, keyframes, 'the child keeps its own keyframes');
  // No group means the layer is untouched apart from its index.
  const solo = effectiveMotion({ enabled: true, trigger: 'load', keyframes }, null, 5);
  assert.equal(solo.trigger, 'load');
  assert.equal(solo.delay, undefined);
  assert.equal(effectiveMotion({ enabled: false, keyframes }, group, 0), null);
  assert.equal(effectiveMotion(null, group, 0), null);
});

test('the group timeline lists every orchestrated layer and when it starts', async () => {
  const { motionGroupItems, describeMotionGroup } = await load();
  const node = {
    id: 'parent', type: 'container',
    settings: { motionGroup: { kind: 'stagger', trigger: 'enter', stagger: 120, label: 'Reveal' } },
    children: [
      card('a', { enabled: true, trigger: 'enter', duration: 600, keyframes }),
      { id: 'b', type: 'container', settings: {}, children: [] },
      card('c', { enabled: true, trigger: 'enter', duration: 600, keyframes }),
    ],
  };
  const items = motionGroupItems(node);
  assert.deepEqual(items.map((item) => item.id), ['a', 'c']);
  // Index is the child's position among siblings, so 'c' staggers past the non-animated node.
  assert.deepEqual(items.map((item) => item.delay), [0, 240]);
  assert.match(describeMotionGroup(node.settings.motionGroup), /Reveal · Section enters view · 120ms stagger/);
  assert.equal(describeMotionGroup(null), '');
});
