// Elementor-style device × state style value model.
//
// Storage shape for every node:  node.styles = { [device]: { [state]: { [controlName]: value } } }
//   devices: desktop | tablet | mobile
//   states:  base | hover | focus | active
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

export const DEVICES = ['desktop', 'tablet', 'mobile'];
export const STATES = ['base', 'hover', 'focus', 'active'];
const STATE_KEYS = new Set(STATES);

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
            if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).some((state) => STATE_KEYS.has(state))) {
                for (const [state, settings] of Object.entries(value)) {
                    if (STATE_KEYS.has(state) && settings && typeof settings === 'object') out[key][state] = { ...out[key][state], ...settings };
                }
            } else {
                out[key].base = { ...out[key].base, ...(value || {}) };
            }
        } else if (STATE_KEYS.has(key)) {
            out.desktop[key] = { ...out.desktop[key], ...(value || {}) };
        } else {
            out.desktop.base[key] = value;
        }
    }
    return out;
}

// Deep-merge a styles patch (nested or legacy-flat) into existing nested styles.
export function mergeStyles(existing, patch) {
    const out = normalizeStyles(existing);
    for (const [device, deviceValue] of Object.entries(normalizeStyles(patch))) {
        for (const [state, settings] of Object.entries(deviceValue)) {
            out[device][state] = { ...out[device][state], ...settings };
        }
    }
    return out;
}

// Resolve which (device, state) a control value lives at for the given editor context.
export function resolveLocation(control, device) {
    const targetDevice = control.responsive ? (device || 'desktop') : 'desktop';
    return { device: targetDevice, state: control.state || 'base' };
}
