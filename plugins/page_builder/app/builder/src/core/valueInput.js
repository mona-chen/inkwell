// Numeric field semantics shared by every value control in the panel: what an author may type,
// how arrow keys and scrubbing move the value, and how an out-of-range value is explained.
//
// This module is deliberately dependency-free and DOM-free. The panel, the control renderers, and
// the node tests all read the same rules, so "12*2" means one thing in the builder and one thing
// in the test suite. Nothing here uses eval(): the expression is parsed and evaluated directly.

const CSS_UNITS = ['px', 'rem', 'em', '%', 'vw', 'vh', 'vmin', 'vmax', 'ch', 'ex', 'fr', 'deg', 'turn', 'rad', 's', 'ms'];
const SIZE_KEYWORDS = ['auto', 'fit-content', 'min-content', 'max-content', 'none', 'initial', 'inherit', 'unset'];

const clean = (value) => String(value ?? '').trim();

export function cssUnits() { return [...CSS_UNITS]; }
export function sizeKeywords() { return [...SIZE_KEYWORDS]; }

// Round away binary float noise (0.1 + 0.2) without pretending to more precision than a browser uses.
export function roundValue(value, precision = 3) {
    const factor = 10 ** precision;
    return Math.round(Number(value) * factor) / factor;
}

// `N%` means "N percent of the current value" (the Figma/Webflow convention): 50% of 240 is 120.
// Without a current value a percentage is just the ratio, which is what a pure calculator expects.
function applyPercent(value, current) {
    if (Number.isFinite(current)) return (value / 100) * Number(current);
    return value / 100;
}

// Recursive-descent parser: expression -> term -> unary -> primary. Supports + - * / ( ) and the
// percentage suffix, and rejects anything else (so a stray "min(" can never be evaluated as math).
export function evaluateExpression(text, { current = null } = {}) {
    let source = String(text ?? '');
    if (!source.trim()) return null;
    if (source.trim().startsWith('=')) source = source.trim().slice(1);
    let index = 0;
    const peek = () => source[index];
    const skipSpace = () => { while (index < source.length && /\s/.test(source[index])) index += 1; };
    const fail = () => { throw new SyntaxError('bad expression'); };

    const parsePrimary = () => {
        skipSpace();
        if (peek() === '(') {
            index += 1;
            const value = parseExpression();
            skipSpace();
            if (peek() !== ')') fail();
            index += 1;
            return value;
        }
        const start = index;
        while (index < source.length && /[0-9.]/.test(source[index])) index += 1;
        if (start === index) fail();
        const literal = Number(source.slice(start, index));
        if (!Number.isFinite(literal)) fail();
        skipSpace();
        if (peek() === '%') { index += 1; return applyPercent(literal, current); }
        return literal;
    };

    const parseUnary = () => {
        skipSpace();
        if (peek() === '-') { index += 1; return -parseUnary(); }
        if (peek() === '+') { index += 1; return parseUnary(); }
        return parsePrimary();
    };

    const parseTerm = () => {
        let value = parseUnary();
        for (;;) {
            skipSpace();
            const operator = peek();
            if (operator !== '*' && operator !== '/') return value;
            index += 1;
            const next = parseUnary();
            if (operator === '*') value *= next;
            else { if (next === 0) fail(); value /= next; }
        }
    };

    function parseExpression() {
        let value = parseTerm();
        for (;;) {
            skipSpace();
            const operator = peek();
            if (operator !== '+' && operator !== '-') return value;
            index += 1;
            const next = parseTerm();
            value = operator === '+' ? value + next : value - next;
        }
    }

    try {
        const result = parseExpression();
        skipSpace();
        if (index !== source.length || !Number.isFinite(result)) return null;
        return result;
    } catch (error) {
        return null;
    }
}

// What the author typed -> a stored value. Returns null for input that must not be committed
// (invalid math, an unknown unit, a half-typed expression), so a stray keystroke can never
// overwrite a real value with NaN.
export function parseValueInput(text, { current = null, units = ['px'], defaultUnit = 'px' } = {}) {
    const raw = clean(text);
    if (!raw) return null;
    const lowered = raw.toLowerCase();
    if (SIZE_KEYWORDS.includes(lowered)) return { size: lowered, unit: '' };
    const match = raw.match(/^([+-]?[0-9.,\s*/%()+\-]*?)\s*([a-z%]{0,4})$/i);
    if (!match) return null;
    const [, expression, suffix] = match;
    const unit = suffix ? suffix.toLowerCase() : '';
    if (unit && !CSS_UNITS.includes(unit)) return null;
    const resolved = evaluateExpression(expression, { current });
    if (resolved === null) return null;
    const nextUnit = unit && !(units.length === 1 && units[0] === unit) ? unit : (unit || (current && typeof current === 'object' && current.unit ? current.unit : defaultUnit));
    return { size: roundValue(resolved), unit: nextUnit };
}

// Arrow keys and drag-scrub share one stepping rule: Alt/Option is a fine step, Shift is a coarse
// one, and every result lands on the control's step grid so values stay tidy.
export function stepValue(value, { step = 1, direction = 1, shift = false, alt = false, min = null, max = null } = {}) {
    const base = Number(step) || 1;
    const multiplier = alt ? 0.1 : shift ? 10 : 1;
    const next = roundValue((Number(value) || 0) + base * multiplier * direction);
    const bounded = clampValue(next, { min, max });
    return bounded.value;
}

// Out-of-range input is corrected visibly rather than silently: the panel shows the reason.
export function clampValue(value, { min = null, max = null } = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return { value, clamped: false, reason: '' };
    const lower = min === null || min === undefined ? null : Number(min);
    const upper = max === null || max === undefined ? null : Number(max);
    const floor = Number.isFinite(lower) ? lower : null;
    const ceiling = Number.isFinite(upper) ? upper : null;
    if (floor !== null && numeric < floor) return { value: floor, clamped: true, reason: `Lowest allowed value is ${floor}` };
    if (ceiling !== null && numeric > ceiling) return { value: ceiling, clamped: true, reason: `Highest allowed value is ${ceiling}` };
    return { value: numeric, clamped: false, reason: '' };
}

// Display text for a stored value: the unit select owns the unit, the input owns the number.
export function formatValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return value.size === null || value.size === undefined ? '' : String(value.size);
    return String(value);
}

// Pointer drag on a numeric field changes the value (the Figma "scrub" gesture). The maths lives
// here so the renderer only owns pointer plumbing.
export function scrubDelta(startValue, startX, currentX, { step = 1, shift = false, alt = false, min = null, max = null, pixelsPerStep = 2 } = {}) {
    const base = Number(step) || 1;
    const multiplier = alt ? 0.1 : shift ? 10 : 1;
    const steps = (Number(currentX) - Number(startX)) / Math.max(1, pixelsPerStep);
    const bounded = clampValue(roundValue(Number(startValue) + steps * base * multiplier), { min, max });
    return bounded.value;
}
