"use strict";

// The image gap: an AI design had no way to see the site's media library and no way to make a
// picture, so every image slot came out empty or held an invented URL. Two rules are load-bearing
// here. The library list is always offered, because reading it needs no configuration; the
// generator is offered only while the site names an image model, because a tool the server cannot
// fulfil is worse than a missing one — the model calls it and stalls the run. Both tools hand back
// the { id, url, alt } shape an Image element's settings.src wants.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = async () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/core/mediaTools.js'), 'utf8');
    return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};

const withGlobals = (config, fetches) => {
    const calls = [];
    global.window = { location: { origin: 'https://example.test' }, ...(config ? { inkCopilot: config } : {}) };
    global.document = { querySelector: () => ({ content: 'csrf-token' }) };
    global.fetch = async (url, options) => {
        calls.push({ url: String(url), options: options || {} });
        const next = fetches.shift();
        if (!next) throw new Error('unexpected fetch: ' + url);
        return next;
    };
    return calls;
};

const jsonResponse = (payload, ok = true, status = 200) => ({
    ok, status, json: async () => payload,
});

test('the library is always listable, and generation follows the site configuration', async () => {
    const { availableMediaTools } = await load();
    const names = () => availableMediaTools().map((tool) => tool.name);

    assert.deepEqual(names(), [ 'list_media' ]);
    // An empty image endpoint is what keeps the tool out of the model's list.
    withGlobals({ imageUrl: null });
    assert.deepEqual(names(), [ 'list_media' ]);
    withGlobals({ imageUrl: '/plugins/ai_writer/images' });
    assert.deepEqual(names(), [ 'list_media', 'generate_image' ]);
});

test('list_media reads the site library and returns placeable media', async () => {
    const { listMedia } = await load();
    const calls = withGlobals({ imageUrl: null }, [ jsonResponse({
        total: 1,
        media: [ { id: 7, url: '/media/7/file', alt: 'Team at work', filename: 'team.png', kind: 'image', width: 1600, height: 900 } ],
    }) ]);

    const result = await listMedia({ query: 'team', limit: 500 });

    assert.match(calls[0].url, /^https:\/\/example\.test\/admin\/media\?/);
    assert.match(calls[0].url, /q=team/);
    // A page of the library, never the whole library.
    assert.match(calls[0].url, /limit=60/);
    // Pictures by default: a document placed in an <img> is a broken picture.
    assert.match(calls[0].url, /type=image/);
    assert.deepEqual(result.media, [ { id: 7, url: '/media/7/file', alt: 'Team at work', filename: 'team.png', kind: 'image', width: 1600, height: 900 } ]);
    assert.equal(result.total, 1);
    assert.match(result.guidance, /settings\.src/);
});

test('list_media asks for documents only when the model asks for them', async () => {
    const { listMedia } = await load();
    const calls = withGlobals({}, [ jsonResponse({ total: 0, media: [] }), jsonResponse({ total: 0, media: [] }), jsonResponse({ total: 0, media: [] }) ]);

    await listMedia({ kind: 'document' });
    await listMedia({ kind: 'all' });
    await listMedia({ kind: 'image' });

    assert.match(calls[0].url, /type=document/);
    assert.doesNotMatch(calls[1].url, /type=/);
    assert.match(calls[2].url, /type=image/);
});

test('list_media tells the model what to do when the library is empty', async () => {
    const { listMedia } = await load();
    withGlobals({}, [ jsonResponse({ total: 0, media: [] }) ]);

    const result = await listMedia({});

    assert.deepEqual(result.media, []);
    assert.match(result.guidance, /leave the media empty/);
    assert.match(result.guidance, /never invent an image url/i);
    // A site that cannot generate pictures is never pointed at the generator.
    assert.doesNotMatch(result.guidance, /generate_image/);
});

test('list_media points an empty result at the generator only when the site has one', async () => {
    const { listMedia } = await load();
    withGlobals({ imageUrl: '/plugins/ai_writer/images' }, [ jsonResponse({ total: 0, media: [] }) ]);

    const result = await listMedia({});

    assert.match(result.guidance, /Call generate_image/);
});

test('list_media surfaces a refused library read instead of inventing media', async () => {
    const { listMedia } = await load();
    withGlobals({}, [ jsonResponse({ error: 'nope' }, false, 403) ]);

    await assert.rejects(() => listMedia({}), /could not be read \(403\)/);
});

test('generate_image posts the description, returns the stored media, and carries the CSRF token', async () => {
    const { generateImage } = await load();
    const calls = withGlobals({ imageUrl: '/plugins/ai_writer/images' }, [ jsonResponse({
        id: 12, url: '/media/12/file', alt: 'A still life of citrus on linen', kind: 'image',
    }) ]);

    const result = await generateImage({ prompt: 'A still life of citrus on linen, soft daylight', alt: 'A still life of citrus on linen', size: '1536x1024' });

    assert.equal(calls[0].url, '/plugins/ai_writer/images');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['X-CSRF-Token'], 'csrf-token');
    assert.deepEqual(JSON.parse(calls[0].options.body), {
        prompt: 'A still life of citrus on linen, soft daylight',
        alt: 'A still life of citrus on linen',
        size: '1536x1024',
    });
    assert.equal(result.url, '/media/12/file');
    assert.match(result.guidance, /settings\.src/);
});

test('generate_image refuses locally when the site has no image model', async () => {
    const { generateImage } = await load();
    const calls = withGlobals({ imageUrl: null }, []);

    await assert.rejects(() => generateImage({ prompt: 'anything' }), /not configured/);
    assert.equal(calls.length, 0);
});

test('generate_image reports the provider error rather than placing a broken picture', async () => {
    const { generateImage } = await load();
    withGlobals({ imageUrl: '/plugins/ai_writer/images' }, [ jsonResponse({ error: 'Image request failed (429): rate limited' }, false, 422) ]);

    await assert.rejects(() => generateImage({ prompt: 'anything' }), /rate limited/);
});

test('generate_image needs a description before it spends money', async () => {
    const { generateImage } = await load();
    const calls = withGlobals({ imageUrl: '/plugins/ai_writer/images' }, []);

    await assert.rejects(() => generateImage({ prompt: '   ' }), /needs a prompt/);
    assert.equal(calls.length, 0);
});
