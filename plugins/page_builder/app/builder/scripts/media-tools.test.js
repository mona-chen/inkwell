"use strict";

// The image gap: an AI design had no way to see the site's media library and no way to get a
// picture, so every image slot came out empty or held an invented URL. One rule is load-bearing:
// a tool is offered only while the server can actually fulfil it, because a tool the server
// cannot serve is worse than a missing one — the model calls it and stalls the run. Listing the
// library always qualifies; generating needs an image model; searching needs a source plugin.
// Every tool hands back the { id, url, alt } shape an Image element's settings.src wants.

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

test('the library is always listable, and search and generation follow the site configuration', async () => {
    const { availableMediaTools } = await load();
    const names = () => availableMediaTools().map((tool) => tool.name);

    assert.deepEqual(names(), [ 'list_media' ]);
    // An empty image endpoint is what keeps the tool out of the model's list.
    withGlobals({ imageUrl: null });
    assert.deepEqual(names(), [ 'list_media' ]);
    withGlobals({ imageUrl: '/plugins/ai_writer/images' });
    assert.deepEqual(names(), [ 'list_media', 'generate_image' ]);

    // Image search is contributed by whichever plugin can serve it, and the kinds it advertises
    // are the kinds that server can actually answer.
    withGlobals({
        imageUrl: null,
        imageSearchUrl: '/plugins/image_sources/search',
        imageProviders: [ { kind: 'photo', label: 'Openverse', provider: 'openverse' }, { kind: 'logo', label: 'Simple Icons', provider: 'simple_icons' } ],
    });
    assert.deepEqual(names(), [ 'list_media', 'search_images' ]);
    const tool = availableMediaTools().find((entry) => entry.name === 'search_images');
    assert.deepEqual(tool.parameters.properties.kind.enum, [ 'photo', 'logo' ]);

    // An endpoint with no usable source is not a capability, and neither is a source with no
    // endpoint to reach it through.
    withGlobals({ imageSearchUrl: '/plugins/image_sources/search', imageProviders: [] });
    assert.deepEqual(names(), [ 'list_media' ]);
    withGlobals({ imageSearchUrl: null, imageProviders: [ { kind: 'photo' } ] });
    assert.deepEqual(names(), [ 'list_media' ]);
});

test('search_images asks the configured source and returns placeable media with its provenance', async () => {
    const { searchImages } = await load();
    const calls = withGlobals({
        imageUrl: null,
        imageSearchUrl: '/plugins/image_sources/search',
        imageProviders: [ { kind: 'photo', label: 'Openverse', provider: 'openverse' } ],
    }, [ jsonResponse({
        query: 'misty pine forest', kind: 'photo', total: 1,
        results: [ { id: 31, url: '/media/31/file', alt: 'Pine forest in fog', kind: 'image', provider: 'openverse', credit: 'A. Photographer', license: 'CC BY 4.0' } ],
        guidance: 'server-side copy is deliberately ignored',
    }) ]);

    const result = await searchImages({ query: 'misty pine forest', kind: 'photo', limit: 99 });

    assert.match(calls[0].url, /^https:\/\/example\.test\/plugins\/image_sources\/search\?/);
    assert.match(calls[0].url, /q=misty\+pine\+forest/);
    assert.match(calls[0].url, /kind=photo/);
    // A page of candidates, never a crawl of the library.
    assert.match(calls[0].url, /limit=8/);
    assert.equal(result.total, 1);
    assert.equal(result.results[0].url, '/media/31/file');
    assert.match(result.guidance, /settings\.src/);
});

test('search_images passes a logo colour through and reports a source that failed', async () => {
    const { searchImages } = await load();
    const calls = withGlobals({ imageSearchUrl: '/plugins/image_sources/search', imageProviders: [ { kind: 'logo' } ] }, [
        jsonResponse({ query: 'stripe', kind: 'logo', total: 0, results: [], errors: [ 'Microlink: the image provider answered with 429.' ] }),
    ]);

    const result = await searchImages({ query: 'stripe', kind: 'logo', color: '#ffffff' });

    assert.match(calls[0].url, /color=%23ffffff/);
    assert.equal(result.total, 0);
    assert.deepEqual(result.errors, [ 'Microlink: the image provider answered with 429.' ]);
    assert.match(result.guidance, /429/);
});

test('search_images refuses locally without a source or a query, and surfaces a server refusal', async () => {
    const { searchImages } = await load();

    const calls = withGlobals({ imageSearchUrl: null }, []);
    await assert.rejects(() => searchImages({ query: 'anything' }), /no image source/);
    assert.equal(calls.length, 0);

    withGlobals({ imageSearchUrl: '/plugins/image_sources/search', imageProviders: [ { kind: 'photo' } ] }, []);
    await assert.rejects(() => searchImages({ query: '   ' }), /needs a query/);

    withGlobals({ imageSearchUrl: '/plugins/image_sources/search', imageProviders: [ { kind: 'photo' } ] }, [
        jsonResponse({ error: 'No image source on this site provides “screenshot”.' }, false, 422),
    ]);
    await assert.rejects(() => searchImages({ query: 'x', kind: 'screenshot' }), /screenshot/);
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

test('list_media points an empty result at search and generation only when the site has them', async () => {
    const { listMedia } = await load();
    withGlobals({ imageUrl: '/plugins/ai_writer/images' }, [ jsonResponse({ total: 0, media: [] }) ]);

    assert.match((await listMedia({})).guidance, /call generate_image/);

    // With a search source too, the empty library points at both.
    withGlobals({
        imageUrl: '/plugins/ai_writer/images',
        imageSearchUrl: '/plugins/image_sources/search',
        imageProviders: [ { kind: 'photo' } ],
    }, [ jsonResponse({ total: 0, media: [] }) ]);
    const both = (await listMedia({})).guidance;
    assert.match(both, /call search_images/);
    assert.match(both, /call generate_image/);

    // With neither, the model is told to build without a picture rather than to invent one.
    withGlobals({ imageUrl: null }, [ jsonResponse({ total: 0, media: [] }) ]);
    assert.match((await listMedia({})).guidance, /neither search nor generate/);
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
