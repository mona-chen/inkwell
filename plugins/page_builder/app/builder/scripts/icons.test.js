"use strict";

// Icon values are stored as one compact string, and the string decides both what renders and whether
// it renders at all. A bare Material name is a font ligature; a bare kebab-case name is a Lucide or
// Phosphor icon the author (or the Copilot) named, and it must resolve to the vendored SVG instead of
// printing its own name on the page. Both rules are load-bearing: getting them wrong is a page of
// literal words where the icons should be.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceOf = (name) => fs.readFileSync(path.join(__dirname, '../src/core', name), 'utf8');
const dataUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');

// icons.js reads the vendored sets with webpack's require.context, so the test stands in a two-icon
// Lucide set and a one-icon Phosphor set and imports the module unmodified.
const load = async () => {
    const svgs = {
        './eye-off.svg': '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>',
        './user-check.svg': '<svg viewBox="0 0 24 24"><path d="M2 2"/></svg>',
        './eye-slash.svg': '<svg viewBox="0 0 256 256"><path d="M3 3"/></svg>',
    };
    const prelude = `
        const __svgs = ${JSON.stringify(svgs)};
        const __stub = (keys) => Object.assign((key) => __svgs[key], { keys: () => keys });
        const __lucide = __stub(['./eye-off.svg', './user-check.svg']);
        const __phosphor = __stub(['./eye-slash.svg']);
    `;
    let index = 0;
    const patched = prelude + sourceOf('icons.js').replace(/require\.context\([^)]*\)/g, () => (index++ === 0 ? '__lucide' : '__phosphor'));
    return import(dataUrl(patched));
};

// A minimal DOM: renderIcon only creates elements, sets attributes and appends.
const fakeDocument = () => {
    const make = (tag, ns) => ({
        tagName: tag, isSvg: Boolean(ns), attributes: {}, children: [], innerHTML: '',
        className: '', textContent: '',
        setAttribute(name, value) { this.attributes[name] = String(value); },
        appendChild(child) { this.children.push(child); return child; },
    });
    return { createElement: (tag) => make(tag, false), createElementNS: (ns, tag) => make(tag, true) };
};

test('a bare name only falls back to a vendored set when it cannot be a Material ligature', async () => {
    const { resolveIcon } = await load();
    // Material Symbols names are snake_case, so a kebab-case name resolves to the vendored icon.
    assert.deepEqual(resolveIcon('eye-off'), { library: 'lucide', name: 'eye-off' });
    assert.deepEqual(resolveIcon('user-check'), { library: 'lucide', name: 'user-check' });
    assert.deepEqual(resolveIcon('eye-slash'), { library: 'phosphor', name: 'eye-slash' });
    // A real Material ligature is never hijacked, and an explicit prefix always wins.
    assert.deepEqual(resolveIcon('arrow_forward'), { library: 'material', name: 'arrow_forward' });
    assert.deepEqual(resolveIcon('lucide:eye-off'), { library: 'lucide', name: 'eye-off' });
    assert.deepEqual(resolveIcon('phosphor:eye'), { library: 'phosphor', name: 'eye' });
    assert.deepEqual(resolveIcon({ library: 'phosphor', name: 'eye' }), { library: 'phosphor', name: 'eye' });
});

test('an unresolved name still renders, as the Material ligature span it claims to be', async () => {
    const { renderIcon } = await load();
    const doc = fakeDocument();
    const svg = renderIcon(doc, 'eye-off');
    assert.equal(svg.tagName, 'svg');
    // The SVG path writes its class as an attribute (inline SVG has no className property here).
    assert.match(svg.attributes.class, /ink-icon-svg/);
    assert.equal(svg.attributes['aria-hidden'], 'true');
    const span = renderIcon(doc, 'totally_made_up');
    assert.equal(span.tagName, 'span');
    assert.equal(span.className, 'material-symbols-rounded');
    assert.equal(span.textContent, 'totally_made_up');
});

test('search_icons finds a storable value instead of letting a name be guessed', async () => {
    const { searchIcons } = await load();
    const values = (query) => searchIcons(query).map((hit) => hit.value);
    assert.ok(values('eye-off').includes('lucide:eye-off'));
    assert.ok(values('eye').includes('lucide:eye-off'));
    assert.ok(values('user check').includes('lucide:user-check'));
    assert.ok(values('user-check').includes('lucide:user-check'));
    assert.equal(searchIcons('').length, 0);
    assert.equal(searchIcons('nothing-matches-this').length, 0);
    assert.ok(searchIcons('eye', 2).length <= 2);
});
