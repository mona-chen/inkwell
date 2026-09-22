// Style values have five producers -- the panel controls, the Copilot, the Sections library, the
// importer, and drag & drop -- and every one of them has to mean the same thing to the compiler.
//
// Two spellings of a size exist in the wild: the builder's canonical `{ size, unit }` and the
// CSS-native `{ value, unit }`. Both express the same intent, so both are accepted and normalized
// to the canonical shape at the storage boundary, which is also what the inspector controls read.
//
// A record that is none of the known shapes has no CSS meaning. The compiler drops and reports it
// instead of stringifying it into the stylesheet, because `width:[object Object]` is how a designed
// page silently degrades back into a pile of unstyled containers.

export const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const present = (value, keys) => keys.some((key) => Object.hasOwn(value, key) && value[key] !== undefined && value[key] !== null);

export const SIZE_KEYS = ['size', 'value'];
export const BOX_KEYS = ['top', 'right', 'bottom', 'left'];
export const GAP_KEYS = ['row', 'column'];
export const SHADOW_KEYS = ['x', 'y'];
export const FILTER_KEYS = ['blur', 'brightness', 'contrast', 'saturate', 'hue'];
export const BORDER_KEYS = ['style', 'width'];
export const STROKE_KEYS = ['strokeWidth'];

// Which record this is. `unknown` means the compiler has no way to render it as CSS.
export function shapeOf(value) {
    if (!isRecord(value)) return typeof value;
    if (present(value, FILTER_KEYS) && !present(value, SHADOW_KEYS)) return 'filter';
    if (present(value, STROKE_KEYS)) return 'stroke';
    if (present(value, SIZE_KEYS)) return 'size';
    if (present(value, BOX_KEYS)) return 'box';
    if (present(value, GAP_KEYS)) return 'gap';
    if (present(value, SHADOW_KEYS)) return 'shadow';
    if (present(value, BORDER_KEYS)) return 'border';
    return 'unknown';
}

// The canonical `{ size, unit }` for either spelling, or null when this is not a size at all.
export function toSize(value) {
    if (shapeOf(value) !== 'size') return null;
    const raw = Object.hasOwn(value, 'size') ? value.size : value.value;
    const size = Number(raw);
    if (!Number.isFinite(size)) return null;
    return { size, unit: typeof value.unit === 'string' && value.unit ? value.unit : 'px' };
}

export function sizeCss(value) {
    const size = toSize(value);
    return size ? `${size.size}${size.unit}` : null;
}

// True when the compiler will have to drop this value: a record it does not recognize, or a size
// whose magnitude is not a number. Callers use this to warn at write time, before the value is
// stored and the design quietly stops applying.
export function isUnsupportedValue(value) {
    if (!isRecord(value)) return false;
    const shape = shapeOf(value);
    if (shape === 'unknown') return true;
    if (shape === 'size') return toSize(value) === null;
    return false;
}

// Repair a single value into canonical storage shape. Anything unrecognized is returned untouched
// rather than dropped: the audit reports it, and losing an author's value would be worse than
// publishing a declaration the compiler can skip.
export function normalizeStyleValue(value) {
    if (Array.isArray(value)) return value.map((item) => normalizeStyleValue(item));
    if (!isRecord(value)) return value;
    const shape = shapeOf(value);
    if (shape === 'size') return toSize(value) || value;
    // Records with independent sides share one unit; storing it explicitly keeps the inspector
    // control and the compiler reading the same thing.
    if ((shape === 'box' || shape === 'gap') && typeof value.unit !== 'string') return { unit: 'px', ...value };
    return value;
}

// Normalize one (device, state) control map.
export function normalizeStyleValues(settings = {}) {
    const out = {};
    for (const [key, value] of Object.entries(settings)) out[key] = normalizeStyleValue(value);
    return out;
}

// A short, safe preview of a value for tool warnings and audit messages.
export function previewValue(value) {
    if (value === null || value === undefined) return String(value);
    if (typeof value !== 'object') return String(value).slice(0, 60);
    if (Array.isArray(value)) return `[${value.length} items]`;
    return `{${Object.keys(value).slice(0, 6).join(', ')}}`;
}

// A size the content decides rather than a magnitude the author typed. `fit-content` is the
// builder's own Frame default, so a stored minimum sitting next to it is placeholder chrome --
// "as wide as my content" and "never narrower than 120px" cannot both be a design decision.
export const HUG_SIZES = new Set(['fit-content', 'max-content', 'min-content', 'auto']);
export const isHugSize = (value) => typeof value === 'string' && HUG_SIZES.has(value.trim().toLowerCase());
