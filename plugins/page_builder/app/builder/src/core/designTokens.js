// The Ink design system: the vocabulary every page is built from.
//
// A page's design language is a small set of TOKENS -- palette, type scale, shape, spacing, motion
// -- not a stylesheet. Tokens are stored on the page (`settings.theme`, which the style engine
// already compiles into `--ink-color-*` and friends), mirrored into CSS custom properties, and
// consumed by the section archetypes. That is what makes a design reproducible: a human changes a
// token in the panel and every archetype section restyles; the Copilot sets the same tokens; the
// importer reads them back out of a captured site.
//
// Everything here is data plus one pure function to render CSS from it. No runtime, no framework.

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const EASING = /^(?:[a-z-]+|cubic-bezier\([\d.,\s-]+\)|steps\([\d,\s-]+\))$/i;
const FONT_STACK = /^[a-zA-Z0-9 ,"'_-]+$/;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = (value, fallback) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; };
const safeColor = (value, fallback) => (HEX.test(String(value ?? '').trim()) ? String(value).trim() : fallback);
const safeFont = (value, fallback) => (FONT_STACK.test(String(value ?? '').trim()) ? String(value).trim().slice(0, 160) : fallback);

export const DEFAULT_TOKENS = Object.freeze({
    colors: Object.freeze({
        background: '#ffffff', surface: '#f6f7f9', text: '#14161a', muted: '#6b7280',
        accent: '#6750ff', accentContrast: '#ffffff', border: '#e5e7eb',
    }),
    typography: Object.freeze({
        fontFamily: 'Inter,ui-sans-serif,system-ui,sans-serif', headingFamily: '',
        baseSize: 16, scale: 1.25, lineHeight: 1.6, headingWeight: 600, headingTracking: -0.02, textWidth: 68,
    }),
    shape: Object.freeze({ radius: 14, radiusSmall: 8, borderWidth: 1 }),
    spacing: Object.freeze({ contentWidth: 1140, pageGutter: 24, sectionGap: 0, blockGap: 24, sectionPadding: 96 }),
    motion: Object.freeze({ duration: 600, easing: 'cubic-bezier(.16,1,.3,1)', stagger: 80 }),
});

// Named starting points. They are ordinary token sets, so an author can pick one and then edit any
// single token -- the preset is a shortcut, never a lock.
export const THEME_PRESETS = Object.freeze({
    editorial: { label: 'Editorial', tokens: { colors: { background: '#f4efe6', surface: '#fffaf2', text: '#171512', muted: '#6f685e', accent: '#f04e3e', accentContrast: '#ffffff', border: '#e2d9cb' }, typography: { fontFamily: 'Inter,ui-sans-serif,system-ui,sans-serif', headingFamily: "Georgia,'Times New Roman',serif", baseSize: 17, scale: 1.33, lineHeight: 1.6, headingWeight: 500, headingTracking: -0.045, textWidth: 62 }, shape: { radius: 6, radiusSmall: 4, borderWidth: 1 }, spacing: { contentWidth: 1180, pageGutter: 32, sectionGap: 0, blockGap: 28, sectionPadding: 112 }, motion: { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)', stagger: 90 } } },
    product: { label: 'Product', tokens: { colors: { background: '#ffffff', surface: '#f5f7ff', text: '#0f172a', muted: '#64748b', accent: '#4f46e5', accentContrast: '#ffffff', border: '#e2e8f0' }, typography: { fontFamily: 'Inter,ui-sans-serif,system-ui,sans-serif', headingFamily: '', baseSize: 16, scale: 1.2, lineHeight: 1.55, headingWeight: 700, headingTracking: -0.025, textWidth: 66 }, shape: { radius: 16, radiusSmall: 10, borderWidth: 1 }, spacing: { contentWidth: 1200, pageGutter: 24, sectionGap: 0, blockGap: 24, sectionPadding: 92 }, motion: { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)', stagger: 70 } } },
    aurora: { label: 'Aurora', tokens: { colors: { background: '#070b18', surface: '#111a33', text: '#f8fafc', muted: '#9aa8c7', accent: '#7dd3fc', accentContrast: '#06121f', border: '#22304f' }, typography: { fontFamily: 'Inter,ui-sans-serif,system-ui,sans-serif', headingFamily: '', baseSize: 16, scale: 1.28, lineHeight: 1.6, headingWeight: 600, headingTracking: -0.03, textWidth: 64 }, shape: { radius: 20, radiusSmall: 12, borderWidth: 1 }, spacing: { contentWidth: 1180, pageGutter: 24, sectionGap: 0, blockGap: 26, sectionPadding: 104 }, motion: { duration: 720, easing: 'cubic-bezier(.16,1,.3,1)', stagger: 90 } } },
    mono: { label: 'Mono', tokens: { colors: { background: '#ffffff', surface: '#fafafa', text: '#0a0a0a', muted: '#737373', accent: '#0a0a0a', accentContrast: '#ffffff', border: '#e5e5e5' }, typography: { fontFamily: "'IBM Plex Mono',ui-monospace,SFMono-Regular,monospace", headingFamily: '', baseSize: 15, scale: 1.18, lineHeight: 1.6, headingWeight: 600, headingTracking: -0.01, textWidth: 74 }, shape: { radius: 2, radiusSmall: 2, borderWidth: 1 }, spacing: { contentWidth: 1080, pageGutter: 24, sectionGap: 0, blockGap: 20, sectionPadding: 80 }, motion: { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)', stagger: 60 } } },
    warm: { label: 'Warm', tokens: { colors: { background: '#fff7f0', surface: '#ffffff', text: '#2b1d16', muted: '#8a7466', accent: '#d97757', accentContrast: '#ffffff', border: '#f0ded2' }, typography: { fontFamily: 'Inter,ui-sans-serif,system-ui,sans-serif', headingFamily: "Georgia,'Times New Roman',serif", baseSize: 17, scale: 1.24, lineHeight: 1.65, headingWeight: 600, headingTracking: -0.02, textWidth: 66 }, shape: { radius: 18, radiusSmall: 10, borderWidth: 1 }, spacing: { contentWidth: 1160, pageGutter: 28, sectionGap: 0, blockGap: 26, sectionPadding: 100 }, motion: { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)', stagger: 84 } } },
});

export function presetNames() { return Object.keys(THEME_PRESETS); }
export function presetTokens(name) {
    const preset = THEME_PRESETS[String(name || '').toLowerCase()];
    return preset ? normalizeTokens(preset.tokens) : null;
}

// One canonical token object. Every value is validated here so a model (or an imported stylesheet)
// can never inject a stylesheet break out of the token vocabulary.
export function normalizeTokens(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const colors = source.colors && typeof source.colors === 'object' ? source.colors : {};
    const typography = source.typography && typeof source.typography === 'object' ? source.typography : {};
    const shape = source.shape && typeof source.shape === 'object' ? source.shape : {};
    const spacing = source.spacing && typeof source.spacing === 'object' ? source.spacing : {};
    const motion = source.motion && typeof source.motion === 'object' ? source.motion : {};
    const baseSize = clamp(number(typography.baseSize, DEFAULT_TOKENS.typography.baseSize), 10, 32);
    return {
        colors: {
            background: safeColor(colors.background, DEFAULT_TOKENS.colors.background),
            surface: safeColor(colors.surface, DEFAULT_TOKENS.colors.surface),
            text: safeColor(colors.text, DEFAULT_TOKENS.colors.text),
            muted: safeColor(colors.muted, DEFAULT_TOKENS.colors.muted),
            accent: safeColor(colors.accent, DEFAULT_TOKENS.colors.accent),
            accentContrast: safeColor(colors.accentContrast, DEFAULT_TOKENS.colors.accentContrast),
            border: safeColor(colors.border, DEFAULT_TOKENS.colors.border),
        },
        typography: {
            fontFamily: safeFont(typography.fontFamily, DEFAULT_TOKENS.typography.fontFamily),
            headingFamily: safeFont(typography.headingFamily, '') || safeFont(typography.fontFamily, DEFAULT_TOKENS.typography.fontFamily),
            baseSize,
            scale: clamp(number(typography.scale, DEFAULT_TOKENS.typography.scale), 1.05, 1.6),
            lineHeight: clamp(number(typography.lineHeight, DEFAULT_TOKENS.typography.lineHeight), 1, 2.2),
            headingWeight: clamp(Math.round(number(typography.headingWeight, DEFAULT_TOKENS.typography.headingWeight)), 100, 900),
            headingTracking: clamp(number(typography.headingTracking, DEFAULT_TOKENS.typography.headingTracking), -0.1, 0.1),
            textWidth: clamp(number(typography.textWidth, DEFAULT_TOKENS.typography.textWidth), 30, 100),
        },
        shape: {
            radius: clamp(number(shape.radius, DEFAULT_TOKENS.shape.radius), 0, 80),
            radiusSmall: clamp(number(shape.radiusSmall, DEFAULT_TOKENS.shape.radiusSmall), 0, 80),
            borderWidth: clamp(number(shape.borderWidth, DEFAULT_TOKENS.shape.borderWidth), 0, 8),
        },
        spacing: {
            contentWidth: clamp(number(spacing.contentWidth, DEFAULT_TOKENS.spacing.contentWidth), 640, 1920),
            pageGutter: clamp(number(spacing.pageGutter, DEFAULT_TOKENS.spacing.pageGutter), 0, 120),
            sectionGap: clamp(number(spacing.sectionGap, DEFAULT_TOKENS.spacing.sectionGap), 0, 200),
            blockGap: clamp(number(spacing.blockGap, DEFAULT_TOKENS.spacing.blockGap), 0, 120),
            sectionPadding: clamp(number(spacing.sectionPadding, DEFAULT_TOKENS.spacing.sectionPadding), 0, 300),
        },
        motion: {
            duration: clamp(Math.round(number(motion.duration, DEFAULT_TOKENS.motion.duration)), 0, 4000),
            easing: EASING.test(String(motion.easing || '')) ? String(motion.easing) : DEFAULT_TOKENS.motion.easing,
            stagger: clamp(Math.round(number(motion.stagger, DEFAULT_TOKENS.motion.stagger)), 0, 800),
        },
    };
}

// The page settings shape the style engine already compiles (`--ink-color-*`, `--ink-content-width`).
// Keeping this projection means a token change flows into real, editable page settings instead of a
// parallel stylesheet, so the Theme panel and the Copilot stay in agreement.
export function themeSettings(tokens) {
    const t = normalizeTokens(tokens);
    return {
        colors: { primary: t.colors.accent, secondary: t.colors.muted, text: t.colors.text, accent: t.colors.accent },
        typography: { fontFamily: t.typography.fontFamily, baseSize: t.typography.baseSize, lineHeight: t.typography.lineHeight },
        spacing: { contentWidth: t.spacing.contentWidth, pageGutter: t.spacing.pageGutter, sectionGap: t.spacing.sectionGap },
    };
}

// Read tokens back off a page's settings so the Copilot and the importer can start from whatever the
// page already is instead of resetting it.
export function tokensFromPageSettings(settings) {
    const theme = settings?.theme || {};
    const colors = theme.colors || {};
    const typography = theme.typography || {};
    const spacing = theme.spacing || {};
    return normalizeTokens({
        colors: { accent: colors.accent, text: colors.text, muted: colors.secondary },
        typography: { fontFamily: typography.fontFamily, baseSize: typography.baseSize, lineHeight: typography.lineHeight },
        spacing: { contentWidth: spacing.contentWidth, pageGutter: spacing.pageGutter, sectionGap: spacing.sectionGap },
    });
}

// --- Reading a design language out of a captured site ------------------------------------------

// Capture evidence stores computed CSS, so colors arrive as `rgb()`/`rgba()` (and occasionally
// `hsl()`). Parse once, flatten alpha against the page background, and emit hex -- which is also
// what `normalizeTokens` accepts, so an inferred token can never be an injection vector.
const FIRST_COLOR = /(?:rgba?|hsla?)\([^)]*\)|#[0-9a-f]{3,8}/i;
// Computed shorthands arrive as `rgb(11, 12, 13) none repeat scroll ...`; the color is one token in
// a longer value, so extract it before parsing.
function firstColor(value) {
    const match = String(value || '').match(FIRST_COLOR);
    return match ? parseColor(match[0]) : null;
}

function parseColor(value) {
    const text = String(value || '').trim();
    const hex = text.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
        const raw = hex[1];
        const expand = (part) => Number.parseInt(part.length === 1 ? part + part : part, 16);
        if (raw.length === 3 || raw.length === 4) return { r: expand(raw[0]), g: expand(raw[1]), b: expand(raw[2]), a: raw.length === 4 ? expand(raw[3]) / 255 : 1 };
        if (raw.length === 6 || raw.length === 8) return { r: expand(raw.slice(0, 2)), g: expand(raw.slice(2, 4)), b: expand(raw.slice(4, 6)), a: raw.length === 8 ? expand(raw.slice(6, 8)) / 255 : 1 };
        return null;
    }
    const fn = text.match(/^(rgba?|hsla?)\(([^)]+)\)$/i);
    if (!fn) return null;
    const parts = fn[2].split(/[,\/\s]+/).filter(Boolean).map((part) => part.trim());
    if (parts.length < 3) return null;
    const alpha = parts.length > 3 ? Number.parseFloat(parts[3]) : 1;
    const a = Number.isFinite(alpha) ? clamp(alpha, 0, 1) : 1;
    if (/^hsl/i.test(fn[1])) {
        const h = ((Number.parseFloat(parts[0]) % 360) + 360) % 360;
        const sat = clamp(Number.parseFloat(parts[1]) || 0, 0, 100) / 100;
        const light = clamp(Number.parseFloat(parts[2]) || 0, 0, 100) / 100;
        const chroma = (1 - Math.abs(2 * light - 1)) * sat;
        const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
        const match = Math.floor(h / 60) % 6;
        const rgb = [[chroma, secondary, 0], [secondary, chroma, 0], [0, chroma, secondary], [0, secondary, chroma], [secondary, 0, chroma], [chroma, 0, secondary]][match];
        const offset = light - chroma / 2;
        return { r: Math.round((rgb[0] + offset) * 255), g: Math.round((rgb[1] + offset) * 255), b: Math.round((rgb[2] + offset) * 255), a };
    }
    const channels = parts.slice(0, 3).map((part) => {
        const percent = part.endsWith('%');
        const parsed = Number.parseFloat(part);
        return Number.isFinite(parsed) ? clamp(percent ? (parsed / 100) * 255 : parsed, 0, 255) : 0;
    });
    return { r: Math.round(channels[0]), g: Math.round(channels[1]), b: Math.round(channels[2]), a };
}

const toHex = ({ r, g, b }) => `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('')}`;
const over = (color, background) => (color.a >= 1 ? color : {
    r: color.r * color.a + background.r * (1 - color.a),
    g: color.g * color.a + background.g * (1 - color.a),
    b: color.b * color.a + background.b * (1 - color.a),
    a: 1,
});
const luminance = ({ r, g, b }) => {
    const channel = (value) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (left, right) => { const a = luminance(left); const b = luminance(right); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
const chroma = (color) => Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
const isOpaque = (color) => Boolean(color) && color.a > 0.6;
// Framer ships `<Family>, "<Family> Placeholder", sans-serif`; the placeholder is a layout shim, not
// a font anyone wants in a token.
const GENERIC_FAMILY = /^(sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|emoji|math|fangsong)$/i;
const cleanFont = (value, fallbackGeneric) => {
    const families = String(value || '').split(',').map((part) => part.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
        .filter((part) => !/placeholder$/i.test(part));
    const generic = families.find((part) => GENERIC_FAMILY.test(part)) || fallbackGeneric || '';
    const named = families.filter((part) => !GENERIC_FAMILY.test(part));
    if (!named.length) return '';
    return [...named.slice(0, 2), generic || 'sans-serif'].join(',');
};
// The browser paints unvisited links `#0000ee` and the computed style reports it, so an unstyled
// anchor looks like a brand color unless it is filtered out.
const UA_COLORS = new Set(['#0000ee', '#0000ff', '#551a8b', '#0000cc']);
const mode = (entries) => {
    const tally = new Map();
    entries.filter(Boolean).forEach((entry) => tally.set(entry, (tally.get(entry) || 0) + 1));
    return [...tally.entries()].sort((left, right) => right[1] - left[1]).map(([value]) => value);
};

// The site's own design language, read off the page it actually rendered: background and surface,
// text and muted, one accent, the type scale, and the shape radius. Nothing is guessed from a name
// and nothing here is site-specific -- only values the capture observed.
export function tokensFromEvidence(viewports) {
    const desktop = (viewports || []).find((viewport) => (viewport.viewport?.width || 0) >= 1000) || (viewports || [])[0];
    if (!desktop) return normalizeTokens(null);
    const viewportWidth = desktop.viewport?.width || 1440;
    const nodes = (desktop.nodes || []).filter((node) => node?.rect && node.rect.width > 0 && node.rect.height > 0);
    const styleOf = (node) => node.style || {};
    const colorOf = (node, property) => firstColor(styleOf(node)[property] || (property === 'background' ? styleOf(node).backgroundColor : ''));

    // Background: the body wins when it paints one; otherwise the largest painted area is the page.
    const bodyBackground = firstColor(desktop.bodyStyle?.background) || firstColor(desktop.bodyStyle?.backgroundColor);
    const painted = nodes.map((node) => ({ node, color: colorOf(node, 'background') })).filter((entry) => isOpaque(entry.color));
    const largest = [...painted].sort((left, right) => (right.node.rect.width * right.node.rect.height) - (left.node.rect.width * left.node.rect.height))[0];
    const background = isOpaque(bodyBackground) ? bodyBackground : (largest?.color || { r: 255, g: 255, b: 255, a: 1 });

    // Text: the most common readable color on the page. A body color that vanishes into the
    // background (very common on dark marketing sites) is ignored in favour of what text nodes use.
    const readable = mode(nodes
        .filter((node) => String(node.text || '').trim().length > 1)
        .map((node) => colorOf(node, 'color'))
        .filter((color) => isOpaque(color) && contrast(color, background) >= 2)
        .map(toHex)
        .filter((hex) => !UA_COLORS.has(hex)));
    const bodyColor = firstColor(desktop.bodyStyle?.color);
    const textHex = readable[0] || (isOpaque(bodyColor) && contrast(bodyColor, background) >= 2 ? toHex(bodyColor) : null)
        || (luminance(background) < 0.4 ? '#ffffff' : '#14161a');
    const text = parseColor(textHex);

    // Muted: a translucent white/black over the background, or the next most common readable color.
    const translucent = mode(nodes.map((node) => colorOf(node, 'color')).filter((color) => color && color.a > 0.3 && color.a < 0.95).map((color) => toHex(over(color, background))))[0];
    const mutedHex = translucent || readable[1] || toHex({ ...text, a: 1 });
    // Keep muted visually quieter than the body text even when the site only ships one color.
    const muted = toHex(contrast(parseColor(mutedHex), background) > contrast(text, background) ? text : parseColor(mutedHex));

    const surfaceHex = mode(painted.map((entry) => toHex(entry.color)).filter((hex) => hex !== toHex(background)))[0] || toHex(over({ ...background, a: 0.4 }, background));
    // A hairline derived from the text color is what almost every modern site ships; reading it from
    // the computed `border` shorthand mostly yields `none`/`0px`, which carries no color intent.
    const border = toHex(over({ ...text, a: 0.14 }, background));

    // Accent: the most common saturated color that is not the background or the text.
    // A brand accent is a fill, not a text color -- and the browser's own unvisited-link blue is not
    // a brand. Rank painted fills first, then text colors, and drop the UA defaults outright.
    const accentCandidates = [
        ...nodes.map((node) => colorOf(node, 'background')),
        ...nodes.map((node) => colorOf(node, 'color')),
    ].filter((color) => isOpaque(color) && chroma(color) > 28)
        .map((color) => toHex(color))
        .filter((hex) => hex !== toHex(background) && hex !== textHex && hex !== mutedHex && hex !== surfaceHex && !UA_COLORS.has(hex));
    const fills = mode(nodes.map((node) => colorOf(node, 'background')).filter((color) => isOpaque(color) && chroma(color) > 28).map(toHex));
    const accent = fills.find((hex) => !UA_COLORS.has(hex) && hex !== toHex(background) && hex !== textHex) || accentCandidates[0] || DEFAULT_TOKENS.colors.accent;


    // Type: the body size the site actually uses for text, and the headings' own family.
    const textSizes = nodes.filter((node) => String(node.text || '').trim().length > 1).map((node) => Number.parseFloat(styleOf(node).fontSize)).filter((size) => Number.isFinite(size) && size >= 13);
    const baseSize = Number.parseFloat(desktop.bodyStyle?.fontSize) >= 13 ? Number.parseFloat(desktop.bodyStyle.fontSize) : (mode(textSizes.map(String))[0] ? Number.parseFloat(mode(textSizes.map(String))[0]) : DEFAULT_TOKENS.typography.baseSize);
    const headings = nodes.filter((node) => ['h1', 'h2'].includes(node.tag));
    const fontFamily = cleanFont(mode(nodes.filter((node) => Number.parseFloat(styleOf(node).fontSize) >= 14).map((node) => styleOf(node).fontFamily))[0]
        || desktop.bodyStyle?.fontFamily, 'sans-serif');
    const headingFamily = cleanFont(mode(headings.map((node) => styleOf(node).fontFamily))[0], '') || fontFamily;
    const display = headings.map((node) => ({ size: Number.parseFloat(styleOf(node).fontSize), weight: Number.parseInt(styleOf(node).fontWeight, 10), spacing: Number.parseFloat(styleOf(node).letterSpacing) }))
        .filter((entry) => Number.isFinite(entry.size) && entry.size >= 28);
    const scale = display.length && baseSize ? clamp((display[0].size / baseSize) ** (1 / 4), 1.05, 1.6) : DEFAULT_TOKENS.typography.scale;
    const tracking = display.find((entry) => Number.isFinite(entry.spacing)) ? display.find((entry) => Number.isFinite(entry.spacing)).spacing / display.find((entry) => Number.isFinite(entry.spacing)).size : DEFAULT_TOKENS.typography.headingTracking;

    const radii = nodes.map((node) => Number.parseFloat(styleOf(node).borderRadius)).filter((value) => Number.isFinite(value) && value > 0 && value <= 48);
    const radius = radii.length ? Number(mode(radii.map((value) => String(Math.round(value))))[0]) : DEFAULT_TOKENS.shape.radius;
    const widths = nodes.map((node) => node.rect.width).filter((width) => width > 560 && width < viewportWidth - 8);

    return normalizeTokens({
        colors: {
            background: toHex(background), surface: surfaceHex, text: textHex, muted, accent,
            accentContrast: toHex(luminance(parseColor(accent)) > 0.45 ? { r: 12, g: 14, b: 18, a: 1 } : { r: 255, g: 255, b: 255, a: 1 }),
            border,
        },
        typography: {
            fontFamily, headingFamily, baseSize, scale,
            lineHeight: Number.parseFloat(desktop.bodyStyle?.lineHeight) || DEFAULT_TOKENS.typography.lineHeight,
            headingWeight: display.find((entry) => Number.isFinite(entry.weight))?.weight,
            headingTracking: Number.isFinite(tracking) ? tracking : undefined,
        },
        shape: { radius },
        spacing: { contentWidth: widths.length ? Math.max(...widths) : undefined },
    });
}

// --- CSS -----------------------------------------------------------------------------------------

// Token custom properties. Namespaced `--ink-t-*` so they never collide with page CSS, plus the
// `--ink-color-*` aliases the canvas vocabulary already uses.
export function tokenVariables(raw) {
    const t = normalizeTokens(raw);
    const type = (step) => `${Math.round(t.typography.baseSize * Math.pow(t.typography.scale, step) * 100) / 100}px`;
    return {
        '--ink-t-bg': t.colors.background,
        '--ink-t-surface': t.colors.surface,
        '--ink-t-text': t.colors.text,
        '--ink-t-muted': t.colors.muted,
        '--ink-t-accent': t.colors.accent,
        '--ink-t-accent-contrast': t.colors.accentContrast,
        '--ink-t-border': t.colors.border,
        '--ink-t-font': t.typography.fontFamily,
        '--ink-t-heading-font': t.typography.headingFamily,
        '--ink-t-base': `${t.typography.baseSize}px`,
        '--ink-t-line': String(t.typography.lineHeight),
        '--ink-t-h1': type(4), '--ink-t-h2': type(3), '--ink-t-h3': type(2), '--ink-t-h4': type(1),
        '--ink-t-h5': type(0.5), '--ink-t-small': type(-0.5), '--ink-t-micro': type(-1),
        '--ink-t-heading-weight': String(t.typography.headingWeight),
        '--ink-t-heading-tracking': `${t.typography.headingTracking}em`,
        '--ink-t-text-width': `${t.typography.textWidth}ch`,
        '--ink-t-radius': `${t.shape.radius}px`,
        '--ink-t-radius-sm': `${t.shape.radiusSmall}px`,
        '--ink-t-border-width': `${t.shape.borderWidth}px`,
        '--ink-t-content': `${t.spacing.contentWidth}px`,
        '--ink-t-gutter': `${t.spacing.pageGutter}px`,
        '--ink-t-gap': `${t.spacing.blockGap}px`,
        '--ink-t-section-pad': `${t.spacing.sectionPadding}px`,
        '--ink-t-duration': `${t.motion.duration}ms`,
        '--ink-t-ease': t.motion.easing,
        '--ink-t-stagger': `${t.motion.stagger}ms`,
        '--ink-color-primary': t.colors.accent,
        '--ink-color-text': t.colors.text,
        '--ink-color-accent': t.colors.accent,
        '--ink-content-width': `${t.spacing.contentWidth}px`,
        '--ink-page-gutter': `${t.spacing.pageGutter}px`,
        '--ink-section-gap': `${t.spacing.sectionGap}px`,
    };
}

// The archetype component vocabulary. Every class an archetype emits is defined here, once, from
// tokens -- so a section and the design system can never drift apart, and a human restyling the
// page edits a token rather than a one-off rule.
export const ARCHETYPE_CSS = `/* Ink design system — archetype vocabulary (token driven) */
.ink-canvas-root .ink-arch-section{position:relative;padding-block:var(--ink-t-section-pad);padding-inline:var(--ink-t-gutter)}
.ink-canvas-root .ink-arch-shell{width:100%;max-width:var(--ink-t-content);margin-inline:auto;display:flex;flex-direction:column;gap:var(--ink-t-gap)}
.ink-canvas-root .ink-arch-stack{display:flex;flex-direction:column;gap:calc(var(--ink-t-gap) * .66)}
.ink-canvas-root .ink-arch-row{display:flex;flex-wrap:wrap;gap:calc(var(--ink-t-gap) * .66);align-items:center}
.ink-canvas-root .ink-arch-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:calc(var(--ink-t-gap) * .9)}
.ink-canvas-root .ink-arch-grid--2{grid-template-columns:repeat(2,minmax(0,1fr))}
.ink-canvas-root .ink-arch-grid--4{grid-template-columns:repeat(4,minmax(0,1fr))}
.ink-canvas-root .ink-arch-split{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:clamp(32px,5vw,72px);align-items:center}
.ink-canvas-root .ink-arch-eyebrow{margin:0;color:var(--ink-t-muted);font:700 var(--ink-t-micro)/1.4 var(--ink-t-font);letter-spacing:.14em;text-transform:uppercase}
.ink-canvas-root .ink-arch-display{margin:0;max-width:18ch;color:var(--ink-t-text);font-family:var(--ink-t-heading-font);font-size:var(--ink-t-h1);font-weight:var(--ink-t-heading-weight);line-height:1.02;letter-spacing:var(--ink-t-heading-tracking);text-wrap:balance}
.ink-canvas-root .ink-arch-title{margin:0;color:var(--ink-t-text);font-family:var(--ink-t-heading-font);font-size:var(--ink-t-h3);font-weight:var(--ink-t-heading-weight);line-height:1.12;letter-spacing:var(--ink-t-heading-tracking)}
.ink-canvas-root .ink-arch-subtitle{margin:0;color:var(--ink-t-text);font-family:var(--ink-t-heading-font);font-size:var(--ink-t-h5);font-weight:var(--ink-t-heading-weight);line-height:1.25}
.ink-canvas-root .ink-arch-lede{margin:0;max-width:var(--ink-t-text-width);color:var(--ink-t-text);font-size:var(--ink-t-h5);line-height:1.55}
.ink-canvas-root .ink-arch-body{margin:0;color:var(--ink-t-muted);font-size:var(--ink-t-base);line-height:var(--ink-t-line)}
.ink-canvas-root .ink-arch-card{padding:calc(var(--ink-t-gap) * 1.1);border:var(--ink-t-border-width) solid var(--ink-t-border);border-radius:var(--ink-t-radius);background:var(--ink-t-surface)}
.ink-canvas-root .ink-arch-card--plain{border-color:transparent;background:transparent;padding:0}
.ink-canvas-root .ink-arch-media{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--ink-t-radius-sm);background:var(--ink-t-surface)}
.ink-canvas-root .ink-arch-media--wide{aspect-ratio:16/9}
.ink-canvas-root .ink-arch-media--portrait{aspect-ratio:3/4}
.ink-canvas-root .ink-arch-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:12px calc(var(--ink-t-gap) * .85);border:var(--ink-t-border-width) solid transparent;border-radius:var(--ink-t-radius-sm);background:var(--ink-t-accent);color:var(--ink-t-accent-contrast);font:600 var(--ink-t-base)/1 var(--ink-t-font);text-decoration:none}
.ink-canvas-root .ink-arch-button--ghost{background:transparent;color:var(--ink-t-text);border-color:var(--ink-t-border)}
.ink-canvas-root .ink-arch-price{margin:0;color:var(--ink-t-text);font-family:var(--ink-t-heading-font);font-size:var(--ink-t-h2);font-weight:var(--ink-t-heading-weight);line-height:1}
.ink-canvas-root .ink-arch-stat{margin:0;color:var(--ink-t-text);font-family:var(--ink-t-heading-font);font-size:var(--ink-t-h3);font-weight:var(--ink-t-heading-weight);line-height:1}
.ink-canvas-root .ink-arch-quote{margin:0;color:var(--ink-t-text);font-family:var(--ink-t-heading-font);font-size:var(--ink-t-h5);line-height:1.4}
.ink-canvas-root .ink-arch-nav-links{display:flex;flex-wrap:wrap;gap:calc(var(--ink-t-gap) * .75);align-items:center}
.ink-canvas-root .ink-arch-nav-link{color:var(--ink-t-text);font:500 var(--ink-t-small)/1 var(--ink-t-font);text-decoration:none}
.ink-canvas-root .ink-arch-badge{display:inline-flex;align-items:center;padding:5px 11px;border-radius:999px;border:var(--ink-t-border-width) solid var(--ink-t-border);color:var(--ink-t-muted);font:600 var(--ink-t-micro)/1 var(--ink-t-font);letter-spacing:.06em;text-transform:uppercase}
.ink-canvas-root .ink-arch-faq-item{padding-block:calc(var(--ink-t-gap) * .7);border-bottom:var(--ink-t-border-width) solid var(--ink-t-border)}
.ink-canvas-root .ink-arch-divider{margin:0;border:0;border-top:var(--ink-t-border-width) solid var(--ink-t-border)}
@media(max-width:991px){.ink-canvas-root .ink-arch-grid,.ink-canvas-root .ink-arch-grid--4{grid-template-columns:repeat(2,minmax(0,1fr))}.ink-canvas-root .ink-arch-split{grid-template-columns:minmax(0,1fr)}}
@media(max-width:640px){.ink-canvas-root .ink-arch-grid,.ink-canvas-root .ink-arch-grid--2,.ink-canvas-root .ink-arch-grid--4{grid-template-columns:minmax(0,1fr)}.ink-canvas-root .ink-arch-display{font-size:var(--ink-t-h2)}}`;

// Section modifiers: one hook per archetype, so a composed page reads as a rhythm (background,
// density, padding) rather than a uniform stack of boxes. Every section class an archetype emits
// is defined here -- the vocabulary test proves there is no class without CSS behind it.
export const SECTION_CSS = `/* Ink design system — section rhythm (token driven) */
.ink-canvas-root .ink-arch-nav{position:relative;z-index:5;padding-block:calc(var(--ink-t-gap) * .6);padding-inline:var(--ink-t-gutter);border-bottom:var(--ink-t-border-width) solid var(--ink-t-border);background:var(--ink-t-bg)}
.ink-canvas-root .ink-arch-hero{padding-block:calc(var(--ink-t-section-pad) * 1.4)}
.ink-canvas-root .ink-arch-logos{padding-block:calc(var(--ink-t-section-pad) * .55);background:var(--ink-t-surface)}
.ink-canvas-root .ink-arch-features{background:var(--ink-t-bg)}
.ink-canvas-root .ink-arch-stats{padding-block:calc(var(--ink-t-section-pad) * .6)}
.ink-canvas-root .ink-arch-gallery{background:var(--ink-t-surface)}
.ink-canvas-root .ink-arch-testimonials{background:var(--ink-t-surface)}
.ink-canvas-root .ink-arch-pricing{background:var(--ink-t-surface)}
.ink-canvas-root .ink-arch-faq{padding-block:calc(var(--ink-t-section-pad) * .75)}
.ink-canvas-root .ink-arch-team{background:var(--ink-t-surface)}
.ink-canvas-root .ink-arch-blog-list{background:var(--ink-t-bg)}
.ink-canvas-root .ink-arch-blog-post{padding-block:calc(var(--ink-t-section-pad) * .8);background:var(--ink-t-bg)}
.ink-canvas-root .ink-arch-profile{padding-block:calc(var(--ink-t-section-pad) * .8)}
.ink-canvas-root .ink-arch-cta{padding-block:calc(var(--ink-t-section-pad) * 1.2);background:var(--ink-t-surface)}
.ink-canvas-root .ink-arch-contact{background:var(--ink-t-surface)}
.ink-canvas-root .ink-arch-footer{padding-block:calc(var(--ink-t-section-pad) * .5);padding-inline:var(--ink-t-gutter);border-top:var(--ink-t-border-width) solid var(--ink-t-border);background:var(--ink-t-surface)}`;

// Component states: behaviour that is pure CSS, so it survives Design, Preview and published
// output with no script -- the monthly/yearly price switch reads a `data-ink-state` on its own
// container, and the orbit deck turns its children into 3D space for the motion group.
export const COMPONENT_CSS = `.ink-canvas-root .ink-arch-price-yearly{display:none}
.ink-canvas-root [data-ink-state="yearly"] .ink-arch-price-monthly{display:none!important}
.ink-canvas-root [data-ink-state="yearly"] .ink-arch-price-yearly{display:block!important}
.ink-canvas-root .ink-arch-orbit-deck{transform-style:preserve-3d;perspective:1200px}
.ink-canvas-root .ink-arch-orbit-deck > *{transform-style:preserve-3d}`;

// One stylesheet per page: the variables an author's own CSS can lean on, plus the archetype
// vocabulary, the section rhythm and the component states. Emitted into the page's custom CSS,
// ahead of any authored rules.
export function designCss(raw) {
    return `${tokenCssBlock(raw)}\n${ARCHETYPE_CSS}\n${SECTION_CSS}\n${COMPONENT_CSS}`;
}

// Just the custom properties, for callers that already carry the rest of the sheet (the importer
// writes this ahead of an imported site's own CSS).
export function tokenCssBlock(raw) {
    const variables = Object.entries(tokenVariables(raw)).map(([name, value]) => `${name}:${value}`).join(';');
    return `:root{${variables}}`;
}

// Install the design system into a page's custom CSS exactly once. Both the Copilot and the human
// Sections library go through here, so a hand-built page and an AI-composed page share one sheet.
export function ensureDesignCss(css, raw) {
    const text = String(css || '');
    if (/\.ink-arch-section\b/.test(text)) return text;
    const installed = designCss(raw);
    return text ? `${installed}\n${text}` : installed;
}

// Apply a design language to the live document: theme settings + the token variables in custom CSS.
// History-aware (both calls are undoable), and shared by `set_design_tokens` and Site Settings.
export function applyDesignTokens({ runtime, customCode }, raw, { label = 'Apply design tokens', commit } = {}) {
    const tokens = normalizeTokens(raw);
    runtime.updateDocumentSettings({ theme: themeSettings(tokens), backgroundColor: tokens.colors.background }, label);
    const existing = customCode.getCss();
    const block = tokenCssBlock(tokens);
    // `g`: an imported page can carry a token block from the capture AND the one the design system
    // installed, and a token edit has to win in both places.
    const nextCss = /:root\{--ink-t-bg:/.test(existing) ? existing.replace(/:root\{--ink-t-bg:[^}]*\}/g, block) : `${block}\n${existing}`;
    // The Copilot passes a history-recording commit; the panel writes straight through.
    if (typeof commit === 'function') commit(nextCss, customCode.getJs(), label);
    else customCode.update(nextCss, customCode.getJs());
    return tokens;
}

export function describeTokens(raw) {
    const t = normalizeTokens(raw);
    return `${t.colors.accent} on ${t.colors.background} · ${t.typography.fontFamily.split(',')[0]} ${t.typography.baseSize}px/${t.typography.scale} · radius ${t.shape.radius}px · ${t.spacing.contentWidth}px`;
}
