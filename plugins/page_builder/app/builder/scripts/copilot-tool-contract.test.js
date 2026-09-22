"use strict";

// What a model can be told about a tool IS the tool's contract: it composes from the schema
// description, not from source. Two facts have to live there, because a model that learns them by
// failing learns them at the cost of a round — and a cut-off payload costs the whole page:
//   1. how many nodes one call may carry, and that a whole page belongs in several calls;
//   2. that replace_page's children cannot be empty, the exact shape that made a truncated call look
//      like a design mistake.
// The file cannot be imported here (its sibling modules are browser-only), so these assertions read
// the source the same way the builder ships it.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/core/CopilotTools.js'), 'utf8');
const entry = (name) => source.slice(source.indexOf(`name: '${name}'`), source.indexOf(`name: '${name}'`) + 1600);

test('the node cap is stated in the schema, interpolated from the same constant the tool enforces', () => {
    assert.match(source, /const MAX_TREE_NODES = \d+;/);

    for (const tool of ['replace_page', 'append_tree']) {
        assert.match(entry(tool), /capped at \$\{MAX_TREE_NODES\} nodes/i, `${tool} must name the node cap in its description`);
    }
});

test('replace_page says it cannot take an empty tree, and append_tree is the multi-section path', () => {
    assert.match(entry('replace_page'), /minItems: 1/);
    assert.match(entry('replace_page'), /append_tree/);
    assert.match(entry('append_tree'), /DEFAULT way to build a multi-section page/);
});

test('capabilities report the same cap, so the number has one source', () => {
    assert.match(source, /maximumNodes: MAX_TREE_NODES/);
});
