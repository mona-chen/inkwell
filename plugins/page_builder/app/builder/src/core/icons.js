// Multi-library icon system. Material Symbols (font glyphs, the default and legacy format),
// Phosphor (fill-style SVG), and Lucide (stroke-style SVG). Icon values are stored as either a
// bare Material name ("star"), a prefixed string ("lucide:home" / "phosphor:house"), or an
// object ({ library, name }).
//
// The full Lucide (ISC) and Phosphor (MIT) icon sets are vendored into src/vendor/lucide and
// src/vendor/phosphor straight from their upstream packages and loaded with webpack
// require.context, so the builder ships every upstream icon and stays fully self-contained
// (no CDN, no runtime fetch). Material Symbols remain font glyphs.

// Parse an upstream SVG file into { viewBox, body } where body is the markup between the
// <svg> tags (paths inherit stroke/fill from the root attributes we re-create in renderIcon).
const parseSvg = (raw) => {
    const match = /<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/.exec(raw || '');
    return match ? { viewBox: match[1], body: match[2].trim() } : null;
};

function loadSvgDirectory(context) {
    const map = {};
    context.keys().forEach((key) => {
        const name = key.replace(/^\.\//, '').replace(/\.svg$/, '');
        const parsed = parseSvg(context(key));
        if (parsed) map[name] = parsed;
    });
    return map;
}

// eslint-disable-next-line no-undef
const LUCIDE = loadSvgDirectory(require.context('../vendor/lucide', false, /\.svg$/));
// eslint-disable-next-line no-undef
const PHOSPHOR = loadSvgDirectory(require.context('../vendor/phosphor', false, /\.svg$/));

const MATERIAL_ICONS = ['star', 'home', 'favorite', 'person', 'settings', 'search', 'check', 'close', 'arrow_forward', 'play_arrow', 'mail', 'phone'];

const LIBRARIES = {
    material: { title: 'Material Symbols', viewBox: null, data: null },
    phosphor: { title: 'Phosphor', viewBox: '0 0 256 256', data: PHOSPHOR },
    lucide: { title: 'Lucide', viewBox: '0 0 24 24', data: LUCIDE },
};

export function libraryTitle(library) { return LIBRARIES[library]?.title || library; }

export function iconCount(library) {
    const meta = LIBRARIES[library] || {};
    return meta.data ? Object.keys(meta.data).length : MATERIAL_ICONS.length;
}

export function iconNames(library) {
    const meta = LIBRARIES[library] || {};
    return meta.data ? Object.keys(meta.data).sort() : MATERIAL_ICONS;
}

// Resolve a stored icon value into { library, name }. Bare strings are Material Symbols.
export function resolveIcon(value) {
    if (value && typeof value === 'object') return { library: value.library || 'material', name: value.name || '' };
    const string = String(value || '');
    const match = /^(lucide|phosphor):(.+)$/.exec(string);
    if (match) return { library: match[1], name: match[2] };
    return { library: 'material', name: string };
}

// Store an icon selection as a compact, migration-safe value.
export function iconValue(library, name) {
    return library === 'material' ? name : `${library}:${name}`;
}

// Render an icon into a DOM element: Material = font glyph span, Phosphor/Lucide = inline SVG.
export function renderIcon(domDocument, value, className = '') {
    const { library, name } = resolveIcon(value);
    if (library === 'material') {
        const span = domDocument.createElement('span');
        span.className = `material-symbols-rounded ${className}`.trim();
        span.textContent = name || 'star';
        return span;
    }
    const meta = LIBRARIES[library];
    const icon = meta?.data?.[name];
    const svg = domDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', icon ? icon.viewBox : meta.viewBox);
    svg.setAttribute('class', `ink-icon-svg ${className}`.trim());
    svg.setAttribute('aria-hidden', 'true');
    if (library === 'phosphor') svg.setAttribute('fill', 'currentColor');
    else { svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); }
    if (icon) svg.innerHTML = icon.body;
    return svg;
}
