// Media tools for the Copilot: the pictures a page needs, and the two ways to get them.
//
// Until now the AI could not see the site's media library and could not make a picture, so
// every image slot in an AI design came out empty (or worse, filled with an invented URL).
// These tools close that gap: list_media reads the library the owner already has, and
// generate_image — offered only once the site names an image model — creates a new picture and
// files it in that same library. Both are plain same-origin fetches against endpoints the
// server owns, and both return the { id, url, alt } shape an Image element's settings.src wants.
//
// This module deliberately imports nothing: the runtime wires it into the tool surface, and the
// node test imports it on its own.

const MEDIA_LIBRARY_URL = '/admin/media';
const MAX_LIST = 60;

const config = () => (typeof window !== 'undefined' && window.inkCopilot) || {};

// The builder page publishes where its own media library lives; the Copilot's settings publish
// the image endpoint, and its absence is what keeps generate_image out of the tool surface.
export const mediaLibraryUrl = () => config().mediaUrl || MEDIA_LIBRARY_URL;
export const imageGenerationUrl = () => config().imageUrl || null;

const csrfToken = () => (typeof document === 'undefined' ? null : document.querySelector('meta[name="csrf-token"]')?.content);

const guidance = (media) => {
    if (media.length) {
        return 'Place a picture by setting an Image element\'s settings.src to one of these urls and its settings.alt to that item\'s alt text (or your own accurate description). These are the site\'s own files; never hotlink an image that is not in this list.';
    }
    // Never point the model at a tool this site cannot serve.
    return imageGenerationUrl()
        ? 'The library has nothing matching. Call generate_image to make the picture this layout needs, then place its url the same way — never invent an image url.'
        : 'The library has nothing matching, and this site cannot generate pictures: leave the media empty and let type and layout carry the design — never invent an image url.';
};

export const LIST_MEDIA_TOOL = {
    name: 'list_media',
    description: "Search the site's own media library — the pictures the owner has already uploaded (pass kind: 'document' for files). Returns each item's id, url, alt text, file name and pixel size. Call this before placing a picture: reusing a real library image (via an Image element's settings.src) is almost always better than an empty frame. An empty result means the library has nothing suitable for that search.",
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Words matched against the file name and alt text, e.g. "team" or "hero". Omit to list the newest items.' },
            kind: { type: 'string', enum: ['image', 'document', 'all'], description: "Defaults to 'image', because pictures are what a page needs. Use 'document' for PDFs and other files, or 'all' for everything." },
            limit: { type: 'number', description: `How many items to return; default 24, maximum ${MAX_LIST}.` },
        },
    },
};

export const GENERATE_IMAGE_TOOL = {
    name: 'generate_image',
    description: "Generate a new picture from a written description and save it to the site's media library, returning its url, id, alt text and size. Use it when a page needs a photograph, illustration, texture or abstract background that the library does not already have, then place the returned url in an Image element's settings.src with alt text. Describe subject, medium, lighting, palette and framing in one detailed prompt. Never ask for words inside the picture, a real person, or a trademarked character.",
    parameters: {
        type: 'object',
        properties: {
            prompt: { type: 'string', description: 'A detailed visual description of the picture to create: subject, setting, medium, lighting, palette, composition.' },
            alt: { type: 'string', description: 'Short alt text describing what the picture shows, for screen readers and search engines. Always supply it.' },
            size: { type: 'string', description: 'Optional pixel size such as "1536x1024" for landscape or "1024x1536" for portrait. Providers usually accept 1024x1024, 1536x1024 and 1024x1536.' },
        },
        required: ['prompt'],
    },
};

// The tool surface is whatever the site is actually configured to do: listing the library needs
// no configuration, generating a picture needs an image model.
export const availableMediaTools = () => (imageGenerationUrl() ? [ LIST_MEDIA_TOOL, GENERATE_IMAGE_TOOL ] : [ LIST_MEDIA_TOOL ]);

export const listMedia = async ({ query = '', kind = 'image', limit = 24 } = {}) => {
    const url = new URL(mediaLibraryUrl(), (typeof window !== 'undefined' && window.location?.origin) || 'http://localhost');
    url.searchParams.set('limit', String(Math.min(Math.max(Number(limit) || 24, 1), MAX_LIST)));
    if (query) url.searchParams.set('q', String(query));
    // Pictures by default: a document in an <img> is a broken picture, and "find me a photo"
    // is the request this tool exists to serve.
    if (kind === 'document') url.searchParams.set('type', 'document');
    else if (kind !== 'all') url.searchParams.set('type', 'image');

    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (!response.ok) throw new Error(`The media library could not be read (${response.status}).`);
    const payload = await response.json();
    const media = (payload.media || []).map((item) => ({
        id: item.id, url: item.url, alt: item.alt || '', filename: item.filename, kind: item.kind,
        ...(item.width ? { width: item.width, height: item.height } : {}),
    }));
    return { total: payload.total ?? media.length, returned: media.length, media, guidance: guidance(media) };
};

export const generateImage = async ({ prompt, alt = '', size = '' } = {}) => {
    const endpoint = imageGenerationUrl();
    if (!endpoint) throw new Error('Image generation is not configured for this site, so no picture can be generated. Build the layout without an image and tell the user that naming an image model in Settings → Copilot enables generated pictures.');
    if (!String(prompt || '').trim()) throw new Error('generate_image needs a prompt describing the picture.');

    const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ prompt, alt, size }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) throw new Error(payload.error || `Image generation failed (${response.status}).`);

    return {
        ...payload,
        guidance: "One picture is now in the media library. Place it by setting an Image element's settings.src to this url and settings.alt to the alt text above.",
    };
};
