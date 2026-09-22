"use strict";

// The style model owns two rules that decide whether an authored value survives: values are
// normalized to one canonical spelling, and a placeholder size floor yields to any axis that
// decides its own size (an explicit size, or a hug). Both are load-bearing -- a failure here is a
// design that silently renders at the wrong size.

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

// A Frame declares no size of its own, so CSS flow decides it: a Frame fills its parent in a block,
// a grid cell or a stretched flex track. That is what makes a card fill the grid column it sits in,
// and it is why a placeholder floor has nothing to yield *to* unless the element asks for a size.
const FRAME_DEFAULTS = { base: { display: 'block', position: 'relative' } };
// The floor map a write judges against: the type's defaults plus the placeholder footprint the Frame
// used to store as real styles (EditorDocument.typeFloors).
const FRAME_FLOORS = { base: { display: 'block', position: 'relative', 'min-width': { size: 120, unit: 'px' }, 'min-height': { size: 80, unit: 'px' } } };
// What a page written by that builder stored on every Frame.
const LEGACY_FRAME = { base: { display: 'block', width: 'fit-content', height: 'fit-content', 'min-width': { size: 120, unit: 'px' }, 'min-height': { size: 80, unit: 'px' }, position: 'relative' } };

test('a placeholder size floor yields whenever the axis decides its own size', async () => {
    const { mergeStyles, normalizeStyles, yieldSizeFloors, emptyStyles } = await load();
    const floors = normalizeStyles(FRAME_FLOORS);
    const legacy = normalizeStyles(LEGACY_FRAME);

    // A Frame that has not decided a size stores none: the placeholder is never invented, so a fresh
    // Frame is sized by its parent and by the chrome that makes an empty one grabbable.
    const created = mergeStyles(emptyStyles(), FRAME_DEFAULTS, { defaultFloors: floors });
    assert.equal(created.desktop.base.width, undefined, 'a Frame must not store a placeholder size');
    assert.equal(created.desktop.base['min-width'], undefined, 'a Frame must not store a placeholder floor');

    const sized = mergeStyles(legacy, { base: { width: { size: 7, unit: 'px' } } }, { defaultFloors: floors });
    assert.deepEqual(sized.desktop.base.width, { size: 7, unit: 'px' });
    assert.equal(sized.desktop.base['min-width'], undefined, 'the 120px placeholder must not win over an explicit 7px');
    assert.equal(sized.desktop.base['min-height'], undefined, 'the untouched axis still hugs, so its floor yields too');

    // A hugging axis is a size decision too: "as wide as my content" cannot also mean "never narrower
    // than 120px". This is the bug behind a padding-sized pill rendering as a 120x80 box.
    const pill = mergeStyles(legacy, { base: { width: 'fit-content', height: 'fit-content' } }, { defaultFloors: floors });
    assert.equal(pill.desktop.base['min-width'], undefined, 'a hugging axis must not keep the placeholder floor');
    assert.equal(pill.desktop.base['min-height'], undefined);

    // The same rule heals stored data, where the write that produced the value is no longer visible.
    const healed = yieldSizeFloors(normalizeStyles(LEGACY_FRAME), { defaults: floors });
    assert.equal(healed.desktop.base['min-width'], undefined);
    assert.equal(healed.desktop.base['min-height'], undefined);

    // A floor the author states is a decision, even when it lands in the same edit as the size.
    const authored = mergeStyles(legacy, { base: { width: { size: 7, unit: 'px' }, 'min-width': { size: 30, unit: 'px' } } }, { defaultFloors: floors });
    assert.deepEqual(authored.desktop.base['min-width'], { size: 30, unit: 'px' });
    const stated = mergeStyles(legacy, { base: { width: 'fit-content', 'min-width': { size: 120, unit: 'px' } } }, { defaultFloors: floors });
    assert.deepEqual(stated.desktop.base['min-width'], { size: 120, unit: 'px' }, 'a floor the same write states is kept');

    // A floor that is not the element's placeholder is never treated as one: a card can legitimately
    // want `width: 100%` above `min-width: 240px`.
    const card = mergeStyles({ base: { width: 'fit-content', 'min-width': { size: 240, unit: 'px' } } }, { base: { width: '100%' } }, { defaultFloors: floors });
    assert.deepEqual(card.desktop.base['min-width'], { size: 240, unit: 'px' });

    // An element that never sized the axis at all has nothing to hug, so the placeholder floor is the
    // only thing keeping it on the canvas and it stays.
    const unsized = yieldSizeFloors(normalizeStyles({ base: { display: 'block', 'min-width': { size: 120, unit: 'px' }, 'min-height': { size: 80, unit: 'px' } } }), { defaults: floors });
    assert.deepEqual(unsized.desktop.base['min-width'], { size: 120, unit: 'px' });
    assert.deepEqual(unsized.desktop.base['min-height'], { size: 80, unit: 'px' });

    // A hover write never becomes the base value, and a device write never rewrites another device.
    const hover = mergeStyles(legacy, { desktop: { hover: { width: { size: 9, unit: 'px' } } } }, { defaultFloors: floors });
    assert.deepEqual(hover.desktop.hover.width, { size: 9, unit: 'px' });
    assert.equal(hover.desktop.base.width, 'fit-content', 'a hover size must not become the base size');
    const tablet = mergeStyles(legacy, { tablet: { base: { width: { size: 640, unit: 'px' } } } }, { defaultFloors: floors });
    assert.deepEqual(tablet.tablet.base.width, { size: 640, unit: 'px' });
    assert.equal(tablet.desktop.base.width, 'fit-content', 'a tablet size must not become the desktop size');
});

test('every merge path stores canonical { size, unit } records', async () => {
    const { mergeStyles, normalizeStyles } = await load();
    const merged = mergeStyles({}, { desktop: { base: { width: { unit: 'px', value: 7 } } } });
    assert.deepEqual(merged.desktop.base.width, { size: 7, unit: 'px' });
    assert.deepEqual(normalizeStyles({ base: { height: { value: 12, unit: 'rem' } } }).desktop.base.height, { size: 12, unit: 'rem' });
});
