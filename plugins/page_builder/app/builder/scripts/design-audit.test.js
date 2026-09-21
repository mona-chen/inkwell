"use strict";

// Store-level design audit: the failures that render "successfully" and still ship a broken page.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = async () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/core/designAudit.js'), 'utf8');
    return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};

const node = (type, styles, settings = {}, children = []) => ({ id: `${type}-${Object.keys(settings).join('')}-${children.length}`, type, settings, styles: { desktop: { base: styles } }, children });

test('a value the compiler dropped is an error, because the page looks styled and is not', async () => {
    const { uncompilableStyles } = await load();
    assert.deepEqual(uncompilableStyles([]), []);
    const [issue] = uncompilableStyles([
        { nodeId: 'a', property: 'width', value: '{unit, value}' },
        { nodeId: 'b', property: 'height', value: '{unit, value}' },
    ]);
    assert.equal(issue.severity, 'error');
    assert.equal(issue.code, 'uncompilable-styles');
    assert.match(issue.message, /2 style values/);
    assert.deepEqual(issue.entries.length, 2);
});

test('class hooks nothing styles are reported; framework hooks and defined rules are not', async () => {
    const { inertClassHooks } = await load();
    const nodes = [
        node('container', {}, { cssClasses: 'sl-hero ink-arch-section' }, [node('heading', {}, { text: 'Hi' })]),
        node('frame', {}, { cssClasses: 'sl-card' }),
        node('paragraph', {}, { text: 'x', cssClasses: 'editorial-lede' }),
    ];
    const cssText = '.ink-canvas-root .ink-arch-section{padding:0}\n.editorial-lede{font-size:18px}';
    const [issue] = inertClassHooks(nodes, cssText);
    assert.equal(issue.code, 'inert-class-hooks');
    assert.deepEqual(issue.classes, ['sl-hero', 'sl-card'], 'ink-* is the framework vocabulary, and a defined rule counts');
    assert.deepEqual(inertClassHooks(nodes, `${cssText}\n.sl-hero{color:red}\n.sl-card{border:1px solid}`), []);
});

test('a text primitive drawing a badge is flagged, an authored button is not', async () => {
    const { glyphAsGraphic } = await load();
    const nodes = [
        node('paragraph', { background: '#17140F', color: '#F7F4EE', width: { unit: 'px', value: 32 }, height: { unit: 'px', value: 32 } }, { text: 'S' }),
        node('paragraph', { 'background-color': '#E4EAE2', width: { size: 40, unit: 'px' }, height: { size: 40, unit: 'px' } }, { text: 'P' }),
        node('button', { 'background-color': '#B4451F', width: 'fit-content', height: 'fit-content' }, { text: 'Search' }),
        node('frame', { background: '#FFFFFF', width: { size: 40, unit: 'px' }, height: { size: 40, unit: 'px' } }),
        node('paragraph', { background: '#FFFFFF', width: { size: 480, unit: 'px' }, height: { size: 120, unit: 'px' } }, { text: 'A panel of copy.' }),
    ];
    const [issue] = glyphAsGraphic(nodes);
    assert.equal(issue.severity, 'warning');
    assert.equal(issue.code, 'glyph-as-graphic');
    assert.equal(issue.elements.length, 2, 'only the two text primitives carrying a fill and a small fixed box');
    assert.deepEqual(issue.elements.map((element) => element.text), ['S', 'P']);
});

test('the audit reads the store, not the theme', async () => {
    const { auditStore, walkNodes } = await load();
    const tree = [node('container', {}, {}, [node('paragraph', { background: '#000', width: { unit: 'px', value: 10 }, height: { unit: 'px', value: 10 } }, { text: 'T', cssClasses: 'sl-pill' })])];
    const nodes = walkNodes(tree);
    assert.equal(nodes.length, 2, 'children are walked');
    const issues = auditStore({ nodes, cssText: '', diagnostics: [{ property: 'min-height', value: '{unit, value}' }] });
    assert.deepEqual(issues.map((issue) => issue.code).sort(), ['glyph-as-graphic', 'inert-class-hooks', 'uncompilable-styles']);
});
