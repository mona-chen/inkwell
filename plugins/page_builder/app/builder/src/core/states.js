// Component states and interactions — the shared vocabulary that turns a styled box into a
// component. Two independent pieces, deliberately kept apart:
//
//   1. Component STATES style an element by variant. Storage lives in the existing
//      device × state bucket under the reserved key `state:<name>` (see StyleValueModel), and
//      compiles to the attribute selector `[data-ink-state="<name>"]` (see StyleEngine). The
//      element that declares the state carries the attribute; its declared parts follow it.
//
//   2. INTERACTIONS wire an event to an effect on a target. They are ordinary element data, so
//      they render in Preview and published pages, are undoable, and are visible to Copilot.
//
// Both are expressed as element data rather than custom JS so a human with the raw builder can
// reproduce anything the Copilot emits, and vice versa.

export const STATE_KEY_PREFIX = 'state:';
const STATE_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

// A component state name is author-facing ("open", "yearly"); the style bucket key is namespaced
// (`state:open`) so it can never collide with the hover/focus/active pseudo-class buckets.
export function normalizeStateName(value) {
    return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function isValidStateName(value) {
    return STATE_NAME_PATTERN.test(String(value ?? ''));
}

export function stateKey(name) { return `${STATE_KEY_PREFIX}${normalizeStateName(name)}`; }

export function isComponentStateKey(key) { return String(key ?? '').startsWith(STATE_KEY_PREFIX); }

export function stateNameFromKey(key) { return isComponentStateKey(key) ? String(key).slice(STATE_KEY_PREFIX.length) : null; }

// The states an element type advertises. Kept as a plain array so definitions stay serializable
// (Copilot receives them through get_element_schema).
export function componentStates(definition) {
    const declared = definition?.componentStates;
    if (!Array.isArray(declared)) return [];
    return declared
        .map((entry) => (typeof entry === 'string' ? { name: entry } : entry))
        .map((entry) => ({ ...entry, name: normalizeStateName(entry?.name) }))
        .filter((entry) => isValidStateName(entry.name));
}

export function componentStateNames(definition) { return componentStates(definition).map((entry) => entry.name); }

// Author-declared states: any element can be a state provider by naming its variants, so a
// pricing container does not need a bespoke element type. Stored as settings.stateNames.
export function normalizeStateList(list) {
    const values = Array.isArray(list) ? list : String(list ?? '').split(/[\s,]+/);
    const seen = new Set();
    return values
        .map(normalizeStateName)
        .filter((name) => isValidStateName(name) && !seen.has(name) && seen.add(name));
}

// The states an element instance actually offers: the ones its type declares plus the ones the
// author named. This is what the state switcher lists and what the canvas can paint.
export function elementStateNames(definition, settings) {
    const declared = [...componentStateNames(definition), ...normalizeStateList(settings?.stateNames)];
    return [...new Set(declared)];
}

export function elementStateLabels(definition, settings) {
    const labels = componentStateLabels(definition);
    normalizeStateList(settings?.stateNames).forEach((name) => { if (!labels[name]) labels[name] = `${name[0].toUpperCase()}${name.slice(1)}`; });
    return labels;
}

export function componentStateLabels(definition) {
    return Object.fromEntries(componentStates(definition).map((entry) => [entry.name, entry.label || `${entry.name[0].toUpperCase()}${entry.name.slice(1)}`]));
}

// The state an instance is authored in. Stored in settings so published pages paint the same
// variant the author chose, without running any script.
export function initialState(definition, settings) {
    const names = elementStateNames(definition, settings);
    if (!names.length) return null;
    const declared = normalizeStateName(settings?.state);
    if (declared && names.includes(declared)) return declared;
    const fallback = normalizeStateName(definition?.defaultState);
    return names.includes(fallback) ? fallback : names[0];
}

export const INTERACTION_EVENTS = ['click', 'hover', 'load', 'enter'];
export const INTERACTION_ACTIONS = ['toggleState', 'setState', 'toggleClass', 'show', 'hide', 'scrollTo', 'playMotion'];
export const INTERACTION_TARGETS = ['self', 'parent', 'next', 'previous', 'query', 'children'];

export const INTERACTION_EVENT_LABELS = {
    click: 'On click', hover: 'On hover', load: 'On page load', enter: 'When scrolled into view'
};
export const INTERACTION_ACTION_LABELS = {
    toggleState: 'Toggle state',
    setState: 'Set state',
    toggleClass: 'Toggle CSS class',
    show: 'Show target',
    hide: 'Hide target',
    scrollTo: 'Scroll to target',
    playMotion: 'Play motion'
};
export const INTERACTION_TARGET_LABELS = {
    self: 'This element', parent: 'Parent element', next: 'Next sibling', previous: 'Previous sibling',
    query: 'Element matching selector', children: 'First child'
};

const SAFE_CLASS = /^[a-zA-Z_][\w-]*$/;

// Normalize one authored interaction. Returns null for records that cannot run, so a bad row in
// the panel can never break the canvas or published output.
export function normalizeInteraction(record) {
    if (!record || typeof record !== 'object') return null;
    const on = INTERACTION_EVENTS.includes(record.on) ? record.on : 'click';
    const action = INTERACTION_ACTIONS.includes(record.action) ? record.action : null;
    if (!action) return null;
    const target = INTERACTION_TARGETS.includes(record.target) ? record.target : 'self';
    const out = { on, action, target };
    const id = String(record.id || '').trim();
    if (id) out.id = id;
    if (['toggleState', 'setState'].includes(action)) {
        const state = normalizeStateName(record.state);
        if (!isValidStateName(state)) return null;
        out.state = state;
        // `exclusive` makes a state group behave like an accordion: setting it clears siblings.
        if (record.exclusive !== undefined) out.exclusive = record.exclusive !== false;
    }
    if (action === 'toggleClass') {
        const className = String(record.className ?? '').trim();
        if (!SAFE_CLASS.test(className)) return null;
        out.className = className;
    }
    if (target === 'query') {
        const selector = String(record.selector ?? '').trim();
        if (!selector) return null;
        out.selector = selector;
    }
    if (['show', 'hide', 'scrollTo', 'playMotion'].includes(action) && record.inverse) out.inverse = true;
    if (record.group) out.group = String(record.group).trim().slice(0, 64);
    const delay = Number(record.delay);
    if (Number.isFinite(delay) && delay > 0) out.delay = Math.min(10000, Math.round(delay));
    return out;
}

export function normalizeInteractions(list) {
    if (!Array.isArray(list)) return [];
    return list.map(normalizeInteraction).filter(Boolean);
}

export function interactionKey(record) {
    return [record.on, record.action, record.target, record.state || record.className || record.selector || ''].join(':');
}

// Human summary used by the panel list and Copilot output ("On click → toggle state open").
export function describeInteraction(record) {
    const event = INTERACTION_EVENT_LABELS[record.on] || record.on;
    const action = INTERACTION_ACTION_LABELS[record.action] || record.action;
    const target = record.target === 'query' ? record.selector : (INTERACTION_TARGET_LABELS[record.target] || record.target).toLowerCase();
    const suffix = record.state || record.className || '';
    return `${event} → ${action}${suffix ? ` ${suffix}` : ''} (${target})`;
}
