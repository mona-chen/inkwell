// Web tools for the Copilot: read a page, and search the open web.
//
// A design is better when its copy is grounded in something real — a product's actual features,
// a company's positioning, an industry's vocabulary. Without these tools the model could only
// design from memory, which is how a page ends up with invented claims. Both tools are plain
// same-origin fetches against an endpoint the server owns; the search key never reaches the
// browser, and the private-address guard lives on the server, not here.
//
// The result of a web read is RESEARCH, never canvas content: the model paraphrases it into
// editable text. It must never drop a foreign URL into a design, which is why the guidance says
// so explicitly every time.
//
// This module deliberately imports nothing: the runtime wires it into the tool surface, and the
// node test imports it on its own.

const config = () => (typeof window !== 'undefined' && window.inkCopilot) || {};

// The server publishes each endpoint only while it can serve it, and an absent endpoint is what
// keeps the tool out of the model's list — a tool the server cannot fulfil stalls the run.
export const webFetchUrl = () => config().webFetchUrl || null;
export const webSearchUrl = () => config().webSearchUrl || null;
export const webSearchProvider = () => config().webSearchProvider || null;

const csrfToken = () => (typeof document === 'undefined' ? null : document.querySelector('meta[name="csrf-token"]')?.content || null);

const post = async (endpoint, body) => {
    const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) throw new Error(payload.error || `The web tool failed (${response.status}).`);
    return payload;
};

export const FETCH_WEB_PAGE_TOOL = {
    name: 'fetch_web_page',
    description: "Read one public web page and return its title and readable text. Use it to ground copy in something real — a product's features, a company's about page, an article the user named. The text is research: write it into editable text yourself, paraphrase rather than paste, and never put the page's URL into a design as a link to a source you cannot vouch for. Only http(s) public pages can be read; private and local addresses are refused.",
    parameters: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'The full http(s) URL of the page to read, e.g. "https://example.com/about".' },
        },
        required: ['url'],
    },
};

export const WEB_SEARCH_TOOL = {
    name: 'web_search',
    description: 'Search the open web and return titles, links and snippets. Call it to find the pages worth reading — then fetch_web_page the most promising one or two. Use it for facts, positioning and vocabulary; the snippets are a starting point, not a source to quote at length.',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'What to look up, phrased as a search, e.g. "Notion pricing page structure".' },
            limit: { type: 'number', description: 'How many results to return; default 5, maximum 8.' },
        },
        required: ['query'],
    },
};

export const availableWebTools = () => {
    const tools = [];
    if (webFetchUrl()) tools.push(FETCH_WEB_PAGE_TOOL);
    if (webSearchUrl()) tools.push(WEB_SEARCH_TOOL);
    return tools;
};

const researchGuidance = () =>
    'This is research, not page content: paraphrase it into your own editable copy, never paste it verbatim and never place a foreign URL in the design. Prefer what the user told you when the two disagree.';

export const fetchWebPage = async ({ url } = {}) => {
    const endpoint = webFetchUrl();
    if (!endpoint) throw new Error('Reading web pages is not available for this site, so build from what the user provided and do not claim outside facts.');
    if (!String(url || '').trim()) throw new Error('fetch_web_page needs the URL of a page to read.');

    const payload = await post(endpoint, { op: 'fetch', url: String(url).trim() });
    return { ...payload, guidance: researchGuidance() };
};

export const webSearch = async ({ query, limit } = {}) => {
    const endpoint = webSearchUrl();
    if (!endpoint) throw new Error('Web search is not configured for this site, so build from what the user provided and do not claim outside facts.');
    if (!String(query || '').trim()) throw new Error('web_search needs a query describing what to look up.');

    const payload = await post(endpoint, { op: 'search', query: String(query).trim(), limit: Number(limit) || 5 });
    return {
        ...payload,
        guidance: `${researchGuidance()} Read the most promising link with fetch_web_page before relying on it.`,
    };
};
