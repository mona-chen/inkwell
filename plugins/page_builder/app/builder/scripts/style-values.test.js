"use strict";

// The style-value contract: one canonical spelling for every record, and no path that lets an
// object reach the stylesheet as "[object Object]".

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = async () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/core/styleValues.js'), 'utf8');
    return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};

test('both spellings of a size normalize to the canonical { size, unit }', async () => {
    const { normalizeStyleValue, toSize, sizeCss, shapeOf, isUnsupportedValue } = await load();
    assert.deepEqual(normalizeStyleValue({ size: 7, unit: 'px' }), { size: 7, unit: 'px' });
    assert.deepEqual(normalizeStyleValue({ unit: 'px', value: 7 }), { size: 7, unit: 'px' });
    assert.deepEqual(normalizeStyleValue({ value: 176 }), { size: 176, unit: 'px' });
    assert.deepEqual(toSize({ value: 12, unit: 'rem' }), { size: 12, unit: 'rem' });
    assert.equal(sizeCss({ unit: 'px', value: 7 }), '7px');
    assert.equal(shapeOf({ unit: 'px', value: 7 }), 'size');
    assert.equal(shapeOf({ value: 'huge' }), 'size', 'the shape comes from the keys, not the magnitude');
    assert.equal(isUnsupportedValue({ value: 'huge' }), true, 'a non-numeric magnitude cannot be compiled');
    assert.equal(isUnsupportedValue({ unit: 'px', value: 7 }), false);
    assert.equal(isUnsupportedValue('#17140F'), false, 'a plain string is always expressible');
});

test('records the compiler cannot express are neither guessed at nor stringified', async () => {
    const { normalizeStyleValue, shapeOf, previewValue, isUnsupportedValue } = await load();
    const broken = { value: { nested: true } };
    assert.equal(isUnsupportedValue(broken), true);
    assert.deepEqual(normalizeStyleValue(broken), broken, 'an unknown record is preserved, never dropped at the boundary');
    assert.equal(previewValue(broken), '{value}');
    assert.equal(previewValue({ color: '#fff', style: 'solid', width: 1 }), '{color, style, width}');
    assert.equal(isUnsupportedValue({ color: '#fff', style: 'solid', width: 1 }), false, 'a border record is known');
    assert.equal(isUnsupportedValue({ nonsense: 1 }), true, 'an invented shape is not');
});

test('sided records gain the unit the inspector and compiler both read', async () => {
    const { normalizeStyleValue, shapeOf } = await load();
    assert.deepEqual(normalizeStyleValue({ top: 26, right: 24, bottom: 26, left: 24 }), { unit: 'px', top: 26, right: 24, bottom: 26, left: 24 });
    assert.deepEqual(normalizeStyleValue({ row: 8, column: 8, unit: 'rem' }), { row: 8, column: 8, unit: 'rem' }, 'an explicit unit is kept');
    assert.deepEqual(normalizeStyleValue({ color: '#E3DBCF', style: 'solid', width: 1 }), { color: '#E3DBCF', style: 'solid', width: 1 });
    assert.equal(shapeOf({ color: '#E3DBCF', style: 'solid', width: 1 }), 'border');
    assert.equal(normalizeStyleValue('fit-content'), 'fit-content', 'plain CSS strings pass through');
    assert.deepEqual(normalizeStyleValue([{ unit: 'px', value: 4 }]), [{ size: 4, unit: 'px' }], 'lists normalize item by item');
});
