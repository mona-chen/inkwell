// Elementor-style device × state style value model.
//
// Storage shape for every node:  node.styles = { [device]: { [state]: { [controlName]: value } } }
//   devices: desktop | tablet | mobile
//   states:  base | hover | focus | active  (CSS pseudo-class buckets)
//            state:<name>                   (component state buckets — see states.js)
//
// This lets a control carry an independent value per (device, state) combination — e.g. a hover
// color that only applies on tablet — which the old flat base/tablet/mobile/hover/focus buckets
// could not represent.
//
// Legacy flat shapes are normalized transparently:
//   { base: {...} }        -> desktop.base
//   { tablet: {...} }      -> tablet.base
//   { hover: {...} }       -> desktop.hover
//   { desktop: {...} }     -> desktop.base (when the value is a flat control map)
//
// Individual control values are normalized too, so every path that writes styles -- the panel, the
// Copilot, the importer, drag & drop -- stores canonical `{ size, unit }` sizing records.

import { isComponentStateKey, normalizeStateName } from './states.js';
import { isRecord, normalizeStyleValue, normalizeStyleValues } from './styleValues.js';

export const DEVICES = ['desktop', 'tablet', 'mobile'];
export const STATES = ['base', 'hover', 'focus', 'active'];
const STATE_KEYS = new Set(STATES);

// A state bucket is either a CSS pseudo-class bucket (hover/focus/active) or a component state
// bucket (`state:open`). Component buckets are free-form per element, so they are only created
// when an element actually uses one.
export const isStateBucket = (key) => STATE_KEYS.has(key) || isComponentStateKey(key);

export function emptyStyles() {
    const styles = {};
    for (const device of DEVICES) { styles[device] = {}; for (const state of STATES) styles[device][state] = {}; }
    return styles;
}

// Normalize any styles value (nested, legacy-flat, or partial) into the full nested shape.
export function normalizeStyles(styles) {
    const out = emptyStyles();
    for (const [key, value] of Object.entries(styles || {})) {
        if (value === undefined || value === null) continue;
        if (DEVICES.includes(key)) {
            if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).some(isStateBucket)) {
                for (const [state, settings] of Object.entries(value)) {
                    if (!isStateBucket(state) || !settings || typeof settings !== 'object') continue;
                    // Legacy flat maps use `state:open`; normalize the suffix so `state:Open` and
                    // `state:open` can never become two buckets for one variant.
                    const name = isComponentStateKey(state) ? `state:${normalizeStateName(state.slice('state:'.length))}` : state;
                    out[key][name] = { ...out[key][name], ...normalizeStyleValues(settings) };
                }
            } else {
                out[key].base = { ...out[key].base, ...normalizeStyleValues(value || {}) };
            }
        } else if (isComponentStateKey(key)) {
            out.desktop[`state:${normalizeStateName(key.slice('state:'.length))}`] = { ...out.desktop.base, ...normalizeStyleValues(value || {}) };
        } else if (STATE_KEYS.has(key)) {
            out.desktop[key] = { ...out.desktop[key], ...normalizeStyleValues(value || {}) };
        } else {
            out.desktop.base[key] = normalizeStyleValue(value);
        }
    }
    return out;
}

const sameValue = (a, b) => {
    if (a === b) return true;
    if (!isRecord(a) || !isRecord(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => sameValue(a[key], b[key]));
};

// A size floor (`min-width`/`min-height`) that is exactly the element type's own placeholder is a
// placeholder, not a decision: it exists so a freshly inserted element is visible and selectable.
// It has to yield the moment a size is set on that axis, or an explicit `width: 7px` silently
// renders at the 120px default -- which is how a designed 7px accent dot ended up as a 120x80 slab.
// A floor with any other value was authored on purpose (a card can want `width: 100%` above
// `min-width: 240px`) and is always kept.
//
// `authored` names the buckets a write is actively setting, so a merged patch is judged only on what
// it says. Passing null instead judges the stored values, which is what heals a page saved by an
// older builder.
export function yieldSizeFloors(styles, { authored = null, defaults = null } = {}) {
    const axes = { width: 'min-width', height: 'min-height' };
    for (const [device, states] of Object.entries(styles || {})) {
        for (const [state, target] of Object.entries(states || {})) {
            if (!target) continue;
            const floor = defaults?.[device]?.[state] || {};
            const set = authored?.[device]?.[state] || null;
            for (const [axis, property] of Object.entries(axes)) {
                if (floor[property] === undefined || !sameValue(target[property], floor[property])) continue;
                const sized = set ? axis in set : target[axis] !== undefined && !sameValue(target[axis], floor[axis]);
                if (sized) delete target[property];
            }
        }
    }
    return styles;
}

// Deep-merge a styles patch (nested or legacy-flat) into existing nested styles. `defaultFloors` is
// the element type's normalized default styles, so the merge can tell a placeholder floor from one
// the author set.
export function mergeStyles(existing, patch, { defaultFloors = null } = {}) {
    const out = normalizeStyles(existing);
    const authored = normalizeStyles(patch);
    for (const [device, deviceValue] of Object.entries(authored)) {
        for (const [state, settings] of Object.entries(deviceValue)) {
            out[device][state] = { ...out[device][state], ...settings };
        }
    }
    return yieldSizeFloors(out, { authored, defaults: defaultFloors });
}

// Resolve which (device, state) a control value lives at for the given editor context.
export function resolveLocation(control, device) {
    const targetDevice = control.responsive ? (device || 'desktop') : 'desktop';
    return { device: targetDevice, state: control.state || 'base' };
}
