const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// states.js is dependency-free ESM, so it can be imported directly from source without a bundler.
const load = async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/core/states.js'), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};

test('component state names are namespaced and normalized into one bucket shape', async () => {
  const { stateKey, normalizeStateName, isComponentStateKey, elementStateNames } = await load();
  assert.equal(normalizeStateName('  Yearly '), 'yearly');
  assert.equal(normalizeStateName('On Sale!'), 'on-sale');
  assert.equal(stateKey('Yearly'), 'state:yearly');
  assert.equal(isComponentStateKey('state:yearly'), true);
  assert.equal(isComponentStateKey('hover'), false);
  // Instance-declared states merge with the ones an element type advertises, without duplicates.
  assert.deepEqual(elementStateNames({ componentStates: ['open', 'closed'] }, { stateNames: [ 'Yearly', 'open' ] }), [ 'open', 'closed', 'yearly' ]);
  assert.deepEqual(elementStateNames({}, { stateNames: 'monthly, yearly monthly' }), [ 'monthly', 'yearly' ]);
});

test('the authored state falls back to the first declared variant', async () => {
  const { initialState } = await load();
  assert.equal(initialState({ componentStates: [ 'closed', 'open' ] }, { state: 'open' }), 'open');
  assert.equal(initialState({ componentStates: [ 'closed', 'open' ] }, {}), 'closed');
  assert.equal(initialState({ componentStates: [ 'closed', 'open' ] }, { state: 'nonsense' }), 'closed');
  assert.equal(initialState({}, {}), null);
});

test('interactions are validated so a bad row can never reach the runtime', async () => {
  const { normalizeInteractions, normalizeInteraction } = await load();
  assert.equal(normalizeInteraction({ on: 'click', action: 'toggleState', target: 'self', state: 'Open' }).state, 'open');
  assert.equal(normalizeInteraction({ on: 'click', action: 'toggleState', target: 'self' }), null, 'a state action without a state is unusable');
  assert.equal(normalizeInteraction({ on: 'click', action: 'nonsense' }), null);
  assert.equal(normalizeInteraction({ on: 'click', action: 'toggleClass', className: '9 bad' }), null);
  assert.equal(normalizeInteraction({ on: 'click', action: 'show', target: 'query' }), null, 'a query target without a selector is unusable');
  const normalized = normalizeInteractions([
    { on: 'hover', action: 'setState', target: 'query', selector: '.panel', state: 'open', exclusive: true, delay: 120 },
    { on: 'click', action: 'toggleClass', className: 'is-open' },
    { on: 'click', action: 'setState', target: 'self' },
  ]);
  assert.equal(normalized.length, 2, 'the unusable row is dropped, the rest survive');
  assert.deepEqual(normalized[0], { on: 'hover', action: 'setState', target: 'query', state: 'open', exclusive: true, delay: 120, selector: '.panel' });
  assert.equal(normalized[1].className, 'is-open');
});

test('interactions have a readable summary for the panel and the model', async () => {
  const { describeInteraction } = await load();
  assert.match(describeInteraction({ on: 'click', action: 'toggleState', target: 'self', state: 'open' }), /On click → Toggle state open/);
  assert.match(describeInteraction({ on: 'enter', action: 'show', target: 'query', selector: '.panel' }), /\.panel/);
});
