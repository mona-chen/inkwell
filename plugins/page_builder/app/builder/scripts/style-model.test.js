"use strict";

// The style model owns two rules that decide whether an authored value survives: values are
// normalized to one canonical spelling, and a placeholder size floor yields to an authored size.
// Both are load-bearing -- a failure here is a design that silently renders at the wrong size.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceOf = (name) => fs.readFileSync(path.join(__dirname, '../src/core', name), 'utf8');
const dataUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');

// Both dependencies are dependency-free ESM, so they can be inlined as data URLs and the model
// imported unmodified from source.
const load = async () => {
    const values = dataUrl(sourceOf('styleValues.js'));
    const states = dataUrl(sourceOf('states.js'));
    const model = sourceOf('StyleValueModel.js')
        .replace("'./states.js'", `'${states}'`)
        .replace("'./styleValues.js'", `'${values}'`);
    return import(dataUrl(model));
};

// A Frame's own defaults: it keeps a fresh, unsized Frame visible and selectable.
const FRAME_DEFAULTS = {
    base: { display: 'block', width: 'fit-content', height: 'fit-content', 'min-width': { size: 120, unit: 'px' }, 'min-height': { size: 80, unit: 'px' }, position: 'relative' },
};

test('a placeholder size floor yields to an authored size, and an authored floor is kept', async () => {
    const { mergeStyles, normalizeStyles, yieldSizeFloors } = await load();
    const defaults = normalizeStyles(FRAME_DEFAULTS);

    const sized = mergeStyles(defaults, { base: { width: { size: 7, unit: 'px' } } }, { defaultFloors: defaults });
    assert.deepEqual(sized.desktop.base.width, { size: 7, unit: 'px' });
    assert.equal(sized.desktop.base['min-width'], undefined, 'the 120px placeholder must not win over an explicit 7px');

    const oneAxis = mergeStyles(defaults, { desktop: { base: { height: { size: 5, unit: 'px' } } } }, { defaultFloors: defaults });
    assert.equal(oneAxis.desktop.base['min-height'], undefined, 'the sized axis yields');
    assert.deepEqual(oneAxis.desktop.base['min-width'], { size: 120, unit: 'px' }, 'the unsized axis keeps its floor');

    // A floor the author states is a decision, even when it lands in the same edit as the size.
    const authored = mergeStyles(defaults, { base: { width: { size: 7, unit: 'px' }, 'min-width': { size: 30, unit: 'px' } } }, { defaultFloors: defaults });
    assert.deepEqual(authored.desktop.base['min-width'], { size: 30, unit: 'px' });

    // A card can legitimately want `width: 100%` above `min-width: 240px`; a floor that is not the
    // element's placeholder is never treated as one.
    const card = mergeStyles({ base: { width: 'fit-content', 'min-width': { size: 240, unit: 'px' } } }, { base: { width: '100%' } }, { defaultFloors: defaults });
    assert.deepEqual(card.desktop.base['min-width'], { size: 240, unit: 'px' });

    const hover = mergeStyles(defaults, { desktop: { hover: { width: { size: 9, unit: 'px' } } } }, { defaultFloors: defaults });
    assert.deepEqual(hover.desktop.base['min-width'], { size: 120, unit: 'px' }, 'a hover size must not clear the base floor');

    // Healing stored data judges the values themselves: a stored placeholder next to an explicit
    // size is noise, while an unsized element keeps the floor that makes it visible.
    const stored = normalizeStyles({ base: { ...FRAME_DEFAULTS.base, width: { size: 7, unit: 'px' } } });
    assert.equal(yieldSizeFloors(stored, { defaults }).desktop.base['min-width'], undefined);
    const unsized = normalizeStyles(FRAME_DEFAULTS);
    assert.deepEqual(yieldSizeFloors(unsized, { defaults }).desktop.base['min-width'], { size: 120, unit: 'px' });
});

test('every merge path stores canonical { size, unit } records', async () => {
    const { mergeStyles, normalizeStyles } = await load();
    const merged = mergeStyles({}, { desktop: { base: { width: { unit: 'px', value: 7 } } } });
    assert.deepEqual(merged.desktop.base.width, { size: 7, unit: 'px' });
    assert.deepEqual(normalizeStyles({ base: { height: { value: 12, unit: 'rem' } } }).desktop.base.height, { size: 12, unit: 'rem' });
});
