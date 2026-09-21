const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/core/gridTracks.js'), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};

test('a grid template becomes an editable list of tracks', async () => {
  const { parseTracks, trackText } = await load();
  assert.deepEqual(parseTracks('1fr 2fr auto').map(trackText), ['1fr', '2fr', 'auto']);
  assert.deepEqual(parseTracks('repeat(3, 1fr)').map(trackText), ['1fr', '1fr', '1fr']);
  assert.deepEqual(parseTracks('repeat(2, minmax(0, 1fr))').map(trackText), ['minmax(0, 1fr)', 'minmax(0, 1fr)']);
  assert.deepEqual(parseTracks('minmax(120px, 1fr) fit-content(20rem)').map(trackText), ['minmax(120px, 1fr)', 'fit-content(20rem)']);
  assert.deepEqual(parseTracks(''), []);
});

test('tracks print back as the CSS an author would have typed', async () => {
  const { parseTracks, serializeTracks, gridTemplate } = await load();
  assert.equal(serializeTracks(parseTracks('120px 1fr auto')), '120px 1fr auto');
  assert.equal(gridTemplate('repeat(2, minmax(0, 1fr))'), 'repeat(2, minmax(0, 1fr))');
  assert.equal(serializeTracks(parseTracks('repeat(4, 1fr)')), 'repeat(4, 1fr)', 'a uniform list collapses back to the shorthand');
  assert.equal(serializeTracks(parseTracks('1fr 2fr')), '1fr 2fr');
});

test('unknown syntax survives a visit to the panel untouched', async () => {
  const { parseTracks, serializeTracks } = await load();
  for (const value of ['calc(100% / 3) 1fr', 'subgrid', 'repeat(auto-fit, minmax(220px, 1fr))']) {
    const tracks = parseTracks(value);
    assert.ok(tracks.length >= 1, value);
    assert.equal(serializeTracks(tracks), value, `${value} must not be rewritten`);
  }
});

test('tracks can be added and removed without losing the sizes already chosen', async () => {
  const { parseTracks, serializeTracks, resizeTracks, tracksFromCount } = await load();
  assert.deepEqual(resizeTracks('120px 1fr', 4).map((track) => track.unit), ['px', 'fr', 'fr', 'fr']);
  assert.equal(serializeTracks(resizeTracks('120px 1fr', 4)), '120px 1fr 1fr 1fr');
  assert.equal(serializeTracks(resizeTracks('repeat(2, minmax(0, 1fr))', 3)), 'repeat(3, minmax(0, 1fr))');
  assert.equal(serializeTracks(resizeTracks('1fr 1fr 1fr', 2)), 'repeat(2, 1fr)');
  assert.equal(serializeTracks(resizeTracks('', 3)), 'repeat(3, 1fr)');
  assert.equal(serializeTracks(tracksFromCount(6)), 'repeat(6, 1fr)');
  assert.equal(resizeTracks('1fr', 0).length, 1, 'a grid always keeps at least one track');
  assert.equal(resizeTracks('1fr', 99).length, 24, 'the track editor stays inside a sane limit');
});
