// Grid track model: the list of columns (or rows) behind a grid layer, so the panel can offer
// tracks an author adds, removes, and sizes instead of a raw CSS string.
//
// The parsed model is what the editor renders and what the tests assert; `gridTemplate` is the
// only thing that reaches the stylesheet, so printed output stays exactly the CSS an author would
// have typed by hand — including collapsing a uniform list back into `repeat(n, 1fr)`.
//
// Dependency-free: shared by the control renderer and the node tests.

export const TRACK_UNITS = ['fr', 'px', '%', 'rem', 'em', 'vw', 'vh', 'ch', 'auto', 'minmax'];
export const TRACK_KEYWORDS = ['auto', 'min-content', 'max-content'];

const clampCount = (count) => Math.max(1, Math.min(24, Math.round(Number(count) || 1)));
const round = (value) => Math.round(Number(value) * 1000) / 1000;

// Split on whitespace, but never inside `minmax(…)` / `fit-content(…)`.
export function splitTracks(text) {
    const source = String(text ?? '').trim();
    if (!source) return [];
    const tokens = [];
    let depth = 0;
    let current = '';
    for (const character of source) {
        if (character === '(') depth += 1;
        if (character === ')') depth = Math.max(0, depth - 1);
        if (/\s/.test(character) && depth === 0) {
            if (current) tokens.push(current);
            current = '';
            continue;
        }
        current += character;
    }
    if (current) tokens.push(current);
    return tokens;
}

function parseSize(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return null;
    if (TRACK_KEYWORDS.includes(raw.toLowerCase())) return { unit: raw.toLowerCase() };
    const sized = raw.match(/^(-?[\d.]+)([a-z%]*)$/i);
    if (!sized) return { unit: 'raw', value: raw };
    const unit = (sized[2] || 'px').toLowerCase();
    return { unit, size: round(Number(sized[1])) };
}

// One token -> one track. Unknown syntax is preserved verbatim (`unit: 'raw'`) so an imported or
// hand-written template survives a visit to the panel untouched.
export function parseTrack(token) {
    const raw = String(token ?? '').trim();
    const lowered = raw.toLowerCase();
    if (TRACK_KEYWORDS.includes(lowered)) return { unit: lowered, raw };
    const fit = lowered.match(/^fit-content\((.+)\)$/);
    if (fit) return { unit: 'fit-content', size: parseSize(fit[1]), raw };
    const minmax = lowered.match(/^minmax\(([^,]+),([^)]+)\)$/);
    if (minmax) return { unit: 'minmax', min: parseSize(minmax[1]) || { unit: 'auto' }, max: parseSize(minmax[2]) || { unit: 'auto' }, raw };
    const sized = parseSize(raw);
    if (sized && sized.unit !== 'raw') return { ...sized, raw };
    return { unit: 'raw', raw };
}

export function parseTracks(text) {
    const tokens = splitTracks(text);
    // `repeat(n, track)` is expanded into real tracks, so the editor lists what the browser lays out.
    const tracks = [];
    tokens.forEach((token) => {
        const repeat = token.match(/^repeat\(\s*(\d+)\s*,\s*(.+)\)$/i);
        if (!repeat) { tracks.push(parseTrack(token)); return; }
        const count = clampCount(repeat[1]);
        const inner = splitTracks(repeat[2]).length ? splitTracks(repeat[2]) : [repeat[2]];
        for (let index = 0; index < count; index += 1) tracks.push(parseTrack(inner[index % inner.length]));
    });
    return tracks;
}

function sizeText(size) {
    if (!size) return 'auto';
    if (size.unit === 'raw') return String(size.value ?? '');
    if (TRACK_KEYWORDS.includes(size.unit)) return size.unit;
    if (size.unit === 'fit-content') return `fit-content(${sizeText(size.size)})`;
    // A bare zero is written as `0` so `minmax(0, 1fr)` round-trips exactly as authored.
    if (Number(size.size) === 0 && size.unit === 'px') return '0';
    return `${round(size.size ?? 0)}${size.unit}`;
}

export function trackText(track) {
    if (!track) return '';
    if (track.unit === 'raw') return String(track.raw ?? '');
    if (track.unit === 'minmax') return `minmax(${sizeText(track.min || { unit: 'auto' })}, ${sizeText(track.max || { unit: 'auto' })})`;
    if (track.unit === 'fit-content') return `fit-content(${sizeText(track.size)})`;
    return sizeText(track);
}

// Uniform tracks print as `repeat(n, x)` — the same shorthand the Grid layout preset uses.
export function serializeTracks(tracks) {
    const list = (Array.isArray(tracks) ? tracks : []).filter(Boolean);
    if (!list.length) return '';
    const texts = list.map(trackText);
    if (list.length > 1 && texts.every((text) => text === texts[0])) return `repeat(${list.length}, ${texts[0]})`;
    return texts.join(' ');
}

export function gridTemplate(value) { return serializeTracks(parseTracks(value)); }

export function trackCount(value) { return parseTracks(value).length; }

// Add or remove tracks without disturbing the sizes already chosen. A new track copies the last
// one (the Figma/Webflow "duplicate this column" behaviour) so a two-column layout keeps matching
// gutters when it grows to three.
export function resizeTracks(value, count, { unit = 'fr' } = {}) {
    const target = clampCount(count);
    const tracks = parseTracks(value);
    const template = tracks.at(-1) || { unit, size: unit === 'fr' ? 1 : 0 };
    while (tracks.length < target) tracks.push(structuredClone(template));
    return tracks.slice(0, target);
}

export function tracksFromCount(count, unit = 'fr') {
    const tracks = [];
    for (let index = 0; index < clampCount(count); index += 1) tracks.push({ unit, size: unit === 'fr' ? 1 : 0 });
    return tracks;
}
