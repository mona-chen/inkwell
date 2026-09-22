"use strict";

// A page tree is hundreds of nodes and is applied atomically, so a rejection is the only feedback a
// composer gets. "Every tree node requires a type." says nothing about WHERE a 300-node payload went
// wrong, or that only one of several problems was seen — so a model retries the same payload until its
// round budget is gone and the user is left with whatever the page already had. These tests pin the
// contract: name the path, name what was found, and report every problem in one pass.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = async () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/core/elementSpec.js'), 'utf8');
    return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};

const DEFINITIONS = {
    container: { acceptsChildren: true },
    frame: { acceptsChildren: true },
    heading: { acceptsChildren: false },
    paragraph: { acceptsChildren: false },
    section: { acceptsChildren: true, internal: true },
};

const runtime = () => ({
    elements: {
        has: (type) => Object.hasOwn(DEFINITIONS, type),
        get: (type) => DEFINITIONS[type],
        accepts: () => true,
    },
    create: (type, values) => ({ id: `${type}-1`, type, settings: values.settings || {}, styles: values.styles || {}, children: [] }),
});

test("a missing type deep in the tree is reported with its exact path and the keys it did have", async () => {
    const { specProblems } = await load();
    const tree = {
        type: 'container',
        children: [
            { type: 'heading', settings: { text: 'Hi' } },
            { type: 'container', children: [ { settings: { text: 'orphan' }, children: [] } ] },
        ],
    };

    const problems = specProblems(runtime(), tree);

    assert.equal(problems.length, 1);
    assert.match(problems[0], /root\.children\[1\]\.children\[0\]/);
    assert.match(problems[0], /has no "type"/);
    assert.match(problems[0], /settings, children/);
});

test('every problem is reported in one pass, not just the first', async () => {
    const { specProblems } = await load();
    const tree = {
        type: 'container',
        children: [
            { settings: { text: 'no type' } },
            { type: 'hologram' },
            { type: 'section' },
            { type: 'heading', children: [ { type: 'paragraph' } ] },
            'a bare string',
            { type: 'container', children: 'not an array' },
        ],
    };

    const problems = specProblems(runtime(), tree);

    assert.equal(problems.length, 6);
    assert.match(problems.join(' | '), /children\[0\] has no "type"/);
    assert.match(problems.join(' | '), /children\[1\] uses "hologram", which is not an element type/);
    assert.match(problems.join(' | '), /children\[2\] uses "section", an editor-only/);
    assert.match(problems.join(' | '), /children\[3\] \("heading"\) cannot contain children/);
    assert.match(problems.join(' | '), /children\[4\] is string, not a node object/);
    assert.match(problems.join(' | '), /children\[5\]\.children must be an array of nodes/);
});

test('a node that used "name" is told which tool wanted which key', async () => {
    const { specProblems, materializeSpec } = await load();
    const tree = { type: 'container', children: [ { name: 'hero', content: {} } ] };

    assert.match(specProblems(runtime(), tree)[0], /"name" is for compose_page\/compose_section archetype sections/);
    assert.throws(() => materializeSpec(runtime(), tree), /"name" is for compose_page/);
});

test('materializeSpec names the offending path instead of a bare refusal', async () => {
    const { materializeSpec } = await load();

    assert.throws(() => materializeSpec(runtime(), { type: 'container', children: [ { settings: {} } ] }),
                  /root\.children\[0\] has no "type"/);
    assert.throws(() => materializeSpec(runtime(), { type: 'container', children: [ null ] }),
                  /root\.children\[0\] is null/);
    assert.throws(() => materializeSpec(runtime(), { type: 'nope' }), /root uses "nope"/);
});

test('a valid tree materializes, and a root node still needs its type', async () => {
    const { materializeSpec, specProblems, specNodeCount } = await load();
    const rt = runtime();
    const tree = { type: 'container', children: [ { type: 'heading', settings: { text: 'Hi' } }, { type: 'paragraph' } ] };

    assert.deepEqual(specProblems(rt, tree), []);
    const node = materializeSpec(rt, tree);
    assert.equal(node.type, 'container');
    assert.deepEqual(node.children.map((child) => child.type), [ 'heading', 'paragraph' ]);
    assert.equal(specNodeCount(tree), 3);
    assert.throws(() => materializeSpec(rt, {}), /root has no "type"/);
});
