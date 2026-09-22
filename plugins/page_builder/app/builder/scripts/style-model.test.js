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

// A Frame's own defaults: it hugs its content and carries a placeholder footprint so a fresh,
// empty Frame stays visible and selectable. That footprint is editor chrome (canvas-editor.scss),
// so the style model only ever removes it from stored data -- it never invents one.
const FRAME_DEFAULTS = {
    base: { display: 'block', width: 'fit-content', height: 'fit-content', 'min-width': { size: 120, unit: 'px' }, 'min-height': { size: 80, unit: 'px' }, position: 'relative' },
};

test('a placeholder size floor yields whenever the axis decides its own size', async () => {
    const { mergeStyles, normalizeStyles, yieldSizeFloors } = await load();
    const defaults = normalizeStyles(FRAME_DEFAULTS);

    const sized = mergeStyles(defaults, { base: { width: { size: 7, unit: 'px' } } }, { defaultFloors: defaults });
    assert.deepEqual(sized.desktop.base.width, { size: 7, unit: 'px' });
    assert.equal(sized.desktop.base['min-width'], undefined, 'the 120px placeholder must not win over an explicit 7px');

    // A hugging axis is a size decision too: "as wide as my content" cannot also mean "never
    // narrower than 120px". This is the bug behind a padding-sized pill rendering as a 120x80 box.
    const pill = mergeStyles(defaults, { base: { width: 'fit-content', height: 'fit-content' } }, { defaultFloors: defaults });
    assert.equal(pill.desktop.base['min-width'], undefined, 'a hugging axis must not keep the placeholder floor');
    assert.equal(pill.desktop.base['min-height'], undefined);

    // The same rule heals stored data, where the write that produced the value is no longer visible.
    const healed = yieldSizeFloors(normalizeStyles(FRAME_DEFAULTS), { defaults });
    assert.equal(healed.desktop.base['min-width'], undefined);
    assert.equal(healed.desktop.base['min-height'], undefined);

    // A floor the author states is a decision, even when it lands in the same edit as the size.
    const authored = mergeStyles(defaults, { base: { width: { size: 7, unit: 'px' }, 'min-width': { size: 30, unit: 'px' } } }, { defaultFloors: defaults });
    assert.deepEqual(authored.desktop.base['min-width'], { size: 30, unit: 'px' });
    const stated = mergeStyles(defaults, { base: { width: 'fit-content', 'min-width': { size: 120, unit: 'px' } } }, { defaultFloors: defaults });
    assert.deepEqual(stated.desktop.base['min-width'], { size: 120, unit: 'px' }, 'a floor the same write states is kept');

    // A floor that is not the element's placeholder is never treated as one: a card can legitimately
    // want `width: 100%` above `min-width: 240px`.
    const card = mergeStyles({ base: { width: 'fit-content', 'min-width': { size: 240, unit: 'px' } } }, { base: { width: '100%' } }, { defaultFloors: defaults });
    assert.deepEqual(card.desktop.base['min-width'], { size: 240, unit: 'px' });

    // An element that never sized the axis at all has nothing to hug, so the placeholder floor is the
    // only thing keeping it on the canvas and it stays.
    const unsized = yieldSizeFloors(normalizeStyles({ base: { display: 'block', 'min-width': { size: 120, unit: 'px' }, 'min-height': { size: 80, unit: 'px' } } }), { defaults });
    assert.deepEqual(unsized.desktop.base['min-width'], { size: 120, unit: 'px' });
    assert.deepEqual(unsized.desktop.base['min-height'], { size: 80, unit: 'px' });

    // A hover write never becomes the base value, and a device write never rewrites another device.
    const hover = mergeStyles(defaults, { desktop: { hover: { width: { size: 9, unit: 'px' } } } }, { defaultFloors: defaults });
    assert.deepEqual(hover.desktop.hover.width, { size: 9, unit: 'px' });
    assert.equal(hover.desktop.base.width, 'fit-content', 'a hover size must not become the base size');
    const tablet = mergeStyles(defaults, { tablet: { base: { width: { size: 640, unit: 'px' } } } }, { defaultFloors: defaults });
    assert.deepEqual(tablet.tablet.base.width, { size: 640, unit: 'px' });
    assert.equal(tablet.desktop.base.width, 'fit-content', 'a tablet size must not become the desktop size');
});

test('every merge path stores canonical { size, unit } records', async () => {
    const { mergeStyles, normalizeStyles } = await load();
    const merged = mergeStyles({}, { desktop: { base: { width: { unit: 'px', value: 7 } } } });
    assert.deepEqual(merged.desktop.base.width, { size: 7, unit: 'px' });
    assert.deepEqual(normalizeStyles({ base: { height: { value: 12, unit: 'rem' } } }).desktop.base.height, { size: 12, unit: 'rem' });
});
