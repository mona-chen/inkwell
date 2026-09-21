// Motion easing vocabulary: the presets the panel offers, the curve maths behind the editor, and
// the single place that decides which easing strings may reach the stylesheet.
//
// Springs are stored as an approximation: the page always carries a legal cubic-bezier in
// `motion.easing`, and the physical parameters are kept alongside it in `motion.spring` so the
// author can reopen the editor with the sliders where they left them. A real multi-bounce spring
// is a keyframe timeline job, which the Motion panel also offers.
//
// Dependency-free on purpose: the panel, the renderer and the node tests share this module.

// The one grammar that decides whether an easing may reach a stylesheet. StyleEngine and the
// design tokens import this pattern, so the panel can never save an easing the CSS silently drops.
// Only animation-timing-function syntax is allowed: no braces, semicolons, or nested functions.
export const EASING_CSS_PATTERN = /^(?:[a-z-]+|cubic-bezier\([\d.,\s-]+\)|steps\([\d,\s-]*(?:,[\s]*(?:start|end|jump-start|jump-end|jump-none|jump-both))?\)|linear\([\d.,%\s-]+\))$/i;

// Canonical keyword values. A curve that matches one of these is written as the keyword, so an
// untouched "Ease out" stays readable in the saved page.
export const EASING_KEYWORDS = {
    linear: [0, 0, 1, 1],
    ease: [0.25, 0.1, 0.25, 1],
    'ease-in': [0.42, 0, 1, 1],
    'ease-out': [0, 0, 0.58, 1],
    'ease-in-out': [0.42, 0, 0.58, 1],
};

export const EASING_PRESETS = [
    { id: 'linear', label: 'Linear', points: EASING_KEYWORDS.linear },
    { id: 'ease', label: 'Ease', points: EASING_KEYWORDS.ease },
    { id: 'ease-in', label: 'Ease in', points: EASING_KEYWORDS['ease-in'] },
    { id: 'ease-out', label: 'Ease out', points: EASING_KEYWORDS['ease-out'] },
    { id: 'ease-in-out', label: 'Ease in out', points: EASING_KEYWORDS['ease-in-out'] },
    { id: 'expo-out', label: 'Expo out', points: [0.16, 1, 0.3, 1] },
    { id: 'quart-in-out', label: 'Quart in out', points: [0.76, 0, 0.24, 1] },
    { id: 'back-out', label: 'Back out', points: [0.34, 1.56, 0.64, 1] },
    { id: 'anticipate', label: 'Anticipate', points: [0.36, -0.07, 0.19, 0.97] },
    { id: 'soft-spring', label: 'Soft spring', points: [0.2, 0.8, 0.2, 1] },
];

export const SPRING_DEFAULTS = { stiffness: 220, damping: 22, mass: 1 };

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
const round = (value) => Math.round(Number(value) * 1000) / 1000;
const samePoints = (a, b) => a.every((value, index) => Math.abs(Number(value) - Number(b[index])) < 0.005);

export function isBezierPoints(points) {
    return Array.isArray(points) && points.length === 4 && points.every((value) => Number.isFinite(Number(value)));
}

// Authored easing (a keyword, a cubic-bezier, or a bare preset name) -> editor state.
export function parseEasing(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return { kind: 'keyword', keyword: 'ease', points: [...EASING_KEYWORDS.ease] };
    if (Object.hasOwn(EASING_KEYWORDS, raw.toLowerCase())) {
        const keyword = raw.toLowerCase();
        return { kind: 'keyword', keyword, points: [...EASING_KEYWORDS[keyword]] };
    }
    const bezier = raw.match(/^cubic-bezier\(([^)]+)\)$/i);
    if (bezier) {
        const points = bezier[1].split(',').map((part) => Number(part.trim()));
        if (isBezierPoints(points)) return { kind: 'bezier', points: points.map((value, index) => index % 2 === 0 ? clamp(value, 0, 1) : value) };
    }
    const preset = EASING_PRESETS.find((entry) => entry.id === raw.toLowerCase());
    if (preset) return { kind: 'bezier', points: [...preset.points] };
    return { kind: 'other', points: [...EASING_KEYWORDS.ease] };
}

// Curve -> stylesheet text. Keywords win when the curve is exactly a keyword's curve.
export function easingCss(points) {
    if (!isBezierPoints(points)) return 'ease';
    const [x1, y1, x2, y2] = points.map(Number);
    for (const [keyword, canonical] of Object.entries(EASING_KEYWORDS)) {
        if (samePoints([x1, y1, x2, y2], canonical)) return keyword;
    }
    return `cubic-bezier(${clamp(x1, 0, 1)},${round(y1)},${clamp(x2, 0, 1)},${round(y2)})`;
}

export function validateEasing(text) {
    const raw = String(text ?? '').trim();
    return EASING_CSS_PATTERN.test(raw) ? raw : '';
}

// Physical spring parameters -> the closest single-overshoot cubic-bezier. Damping ratio decides
// whether the curve overshoots at all; the overshoot size sets how far past 1 the first handle
// reaches, which is exactly how a back-out curve behaves.
export function springToBezier({ stiffness = SPRING_DEFAULTS.stiffness, damping = SPRING_DEFAULTS.damping, mass = SPRING_DEFAULTS.mass } = {}) {
    const k = Math.max(1, Number(stiffness) || SPRING_DEFAULTS.stiffness);
    const c = Math.max(0, Number(damping) || 0);
    const m = Math.max(0.05, Number(mass) || SPRING_DEFAULTS.mass);
    const omega = Math.sqrt(k / m);
    const zeta = c / (2 * Math.sqrt(k * m));
    if (zeta >= 1) return [0.22, 1, 0.36, 1];
    const overshoot = Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta));
    return [round(clamp(0.12 + 0.4 * zeta, 0.06, 0.5)), round(clamp(1 + 1.6 * overshoot, 1, 1.8)), round(clamp(0.62 + 0.2 * zeta, 0.5, 0.92)), 1];
}

// How long the spring takes to settle within 2% of its target: a useful default duration, so
// choosing a spring does not leave the author guessing at the millisecond field.
export function springSettleMs({ stiffness = SPRING_DEFAULTS.stiffness, damping = SPRING_DEFAULTS.damping, mass = SPRING_DEFAULTS.mass } = {}) {
    const k = Math.max(1, Number(stiffness) || SPRING_DEFAULTS.stiffness);
    const c = Math.max(0, Number(damping) || 0);
    const m = Math.max(0.05, Number(mass) || SPRING_DEFAULTS.mass);
    const omega = Math.sqrt(k / m);
    const zeta = c / (2 * Math.sqrt(k * m));
    const settle = (zeta <= 0 ? 1 / omega * 8 : -Math.log(0.02) / (zeta * omega)) * 1000;
    return Math.round(clamp(settle * 0.5, 80, 4000));
}

// Cubic-bezier evaluation for the editor preview and the curve path.
function bezierAxis(a, b, t) {
    const inv = 1 - t;
    return 3 * inv * inv * t * a + 3 * inv * t * t * b + t * t * t;
}

export function bezierValueAt(points, progress) {
    if (!isBezierPoints(points)) return Number(progress) || 0;
    const [x1, y1, x2, y2] = points.map(Number);
    const target = clamp(progress, 0, 1);
    let low = 0;
    let high = 1;
    let t = target;
    for (let step = 0; step < 32; step += 1) {
        const x = bezierAxis(x1, x2, t);
        if (Math.abs(x - target) < 1e-5) break;
        if (x < target) low = t; else high = t;
        t = (low + high) / 2;
    }
    return bezierAxis(y1, y2, t);
}

// The drawing box for the curve editor: one place that knows how time and progress map onto SVG
// coordinates, so the handle a reader drags and the path they see can never disagree.
export function easingBox({ width = 100, height = 100, padding = 12 } = {}) {
    const spanX = width - padding * 2;
    const spanY = (height - padding * 2) / 1.4;
    return {
        width, height, padding,
        x: (value) => padding + clamp(value, 0, 1) * spanX,
        y: (value) => height - padding - (clamp(value, -0.4, 1.8) + 0.4) * spanY,
        unx: (pixels) => clamp((Number(pixels) - padding) / spanX, 0, 1),
        uny: (pixels) => clamp((height - padding - Number(pixels)) / spanY - 0.4, -0.4, 1.8),
    };
}

// SVG path for the curve editor: x is time, y is progress, drawn inside a box with padding so an
// overshooting curve is not clipped. Accepts a box from `easingBox` or the options to build one.
export function bezierPath(points, boxOrOptions = {}) {
    const box = typeof boxOrOptions?.x === 'function' ? boxOrOptions : easingBox(boxOrOptions);
    const samples = Number.isFinite(boxOrOptions.samples) ? boxOrOptions.samples : 48;
    const [x1, y1, x2, y2] = (isBezierPoints(points) ? points : EASING_KEYWORDS.ease).map(Number);
    const steps = [];
    for (let index = 0; index <= samples; index += 1) {
        const t = index / samples;
        steps.push(`${index === 0 ? 'M' : 'L'}${round(box.x(bezierAxis(x1, x2, t)))} ${round(box.y(bezierAxis(y1, y2, t)))}`);
    }
    return { path: steps.join(' '), handle1: { x: round(box.x(x1)), y: round(box.y(y1)) }, handle2: { x: round(box.x(x2)), y: round(box.y(y2)) }, origin: { x: round(box.x(0)), y: round(box.y(0)) }, end: { x: round(box.x(1)), y: round(box.y(1)) }, bounds: { width: box.width, height: box.height, padding: box.padding } };
}
