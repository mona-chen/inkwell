"use strict";

// The web gap: the Copilot could only design from memory, so copy was invented or generic. Two
// tools close it — web_search finds pages, fetch_web_page reads one. One rule is load-bearing and
// mirrors the image tools: a tool is offered only while the server can actually serve it, because
// a tool the server cannot fulfil stalls the run. Reading is keyless; searching needs a provider.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const load = async () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/core/webTools.js'), 'utf8');
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

const jsonResponse = (payload, ok = true, status = 200) => ({ ok, status, json: async () => payload });

test('no search provider means no web_search, and turning fetch off removes fetch_web_page', async () => {
    const { availableWebTools } = await load();
    const names = () => availableWebTools().map((tool) => tool.name);

    withGlobals({});
    assert.deepEqual(names(), []);

    withGlobals({ webFetchUrl: '/plugins/ai_writer/web' });
    assert.deepEqual(names(), [ 'fetch_web_page' ]);

    withGlobals({ webFetchUrl: '/plugins/ai_writer/web', webSearchUrl: '/plugins/ai_writer/web' });
    assert.deepEqual(names(), [ 'fetch_web_page', 'web_search' ]);
});

test('fetch_web_page posts the url and returns the page text as research', async () => {
    const { fetchWebPage } = await load();
    const calls = withGlobals({ webFetchUrl: '/plugins/ai_writer/web' }, [
        jsonResponse({ url: 'https://example.com/about', title: 'About', text: 'We build things.', truncated: false }),
    ]);

    const result = await fetchWebPage({ url: 'https://example.com/about' });
    assert.equal(calls[0].url, '/plugins/ai_writer/web');
    assert.equal(calls[0].options.headers['X-CSRF-Token'], 'csrf-token');
    assert.deepEqual(JSON.parse(calls[0].options.body), { op: 'fetch', url: 'https://example.com/about' });
    assert.equal(result.title, 'About');
    assert.match(result.guidance, /research, not page content/);
});

test('fetch_web_page refuses locally when reading is switched off', async () => {
    const { fetchWebPage } = await load();
    const calls = withGlobals({}, []);

    await assert.rejects(() => fetchWebPage({ url: 'https://example.com' }), /not available/);
    assert.equal(calls.length, 0);
});

test('fetch_web_page needs a url before it asks the server', async () => {
    const { fetchWebPage } = await load();
    const calls = withGlobals({ webFetchUrl: '/plugins/ai_writer/web' }, []);

    await assert.rejects(() => fetchWebPage({ url: '   ' }), /needs the URL/);
    assert.equal(calls.length, 0);
});

test('web_search posts the query and passes the limit through', async () => {
    const { webSearch } = await load();
    const calls = withGlobals({ webSearchUrl: '/plugins/ai_writer/web' }, [
        jsonResponse({ query: 'notion pricing', provider: 'brave', results: [ { title: 'Pricing', url: 'https://notion.so/pricing', snippet: 'Plans' } ] }),
    ]);

    const result = await webSearch({ query: 'notion pricing', limit: 3 });
    assert.deepEqual(JSON.parse(calls[0].options.body), { op: 'search', query: 'notion pricing', limit: 3 });
    assert.equal(result.results[0].url, 'https://notion.so/pricing');
    assert.match(result.guidance, /Read the most promising link/);
});

test('web_search defaults the limit and refuses an empty query', async () => {
    const { webSearch } = await load();
    const calls = withGlobals({ webSearchUrl: '/plugins/ai_writer/web' }, [ jsonResponse({ results: [] }) ]);

    await webSearch({ query: 'anything' });
    assert.equal(JSON.parse(calls[0].options.body).limit, 5);

    await assert.rejects(() => webSearch({ query: '  ' }), /needs a query/);
});

test('a server refusal is reported instead of swallowed', async () => {
    const { webSearch } = await load();
    withGlobals({ webSearchUrl: '/plugins/ai_writer/web' }, [ jsonResponse({ error: 'Web search is not configured for this site.' }, false, 422) ]);

    await assert.rejects(() => webSearch({ query: 'x' }), /not configured/);
});
