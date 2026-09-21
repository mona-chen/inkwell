// Design-quality rules that read the STORE rather than the painted canvas.
//
// The canvas-level checks (overflow, tiny text, collapsed headings) catch layout that breaks after
// it renders. These catch the failure mode that renders "successfully" and still ships a broken
// page: a value the compiler could not express, a class hook nothing styles, or a text primitive
// pressed into service as a graphic. All three are invisible in a screenshot review, which is why
// they belong in the audit the Copilot is required to run.

const TEXT_TYPES = new Set(['heading', 'paragraph', 'link', 'text', 'span', 'label', 'inline-text']);

// Framework hooks are provided by the canvas vocabulary, never by page CSS.
const FRAMEWORK_CLASS = /^ink-/;

export const walkNodes = (roots = []) => {
    const all = [];
    const visit = (node) => { all.push(node); (node.children || []).forEach(visit); };
    roots.forEach(visit);
    return all;
};

const baseOf = (node) => {
    const styles = node?.styles;
    if (!styles || typeof styles !== 'object') return {};
    const device = styles.desktop || styles;
    if (!device || typeof device !== 'object') return {};
    return device.base || device;
};

export const classNamesOf = (node) => String(node?.settings?.cssClasses || '').split(/\s+/).filter(Boolean);

const fillOf = (base) => {
    const fill = base.background ?? base['background-color'];
    if (typeof fill !== 'string') return null;
    const value = fill.trim().toLowerCase();
    return value && value !== 'transparent' && value !== 'none' ? fill : null;
};

// A fixed pixel box small enough that only a glyph or a swatch fits in it.
const fixedBoxOf = (base) => {
    const size = (value) => {
        if (!value || typeof value !== 'object') return null;
        const raw = value.size ?? value.value;
        const px = Number(raw);
        if (!Number.isFinite(px) || px <= 0) return null;
        const unit = value.unit || 'px';
        return unit === 'px' ? px : null;
    };
    const width = size(base.width);
    const height = size(base.height);
    return width !== null && height !== null ? { width, height } : null;
};

// 1. Values the compiler dropped. The page looks styled in the tree and unstyled on screen.
export function uncompilableStyles(diagnostics = []) {
    if (!diagnostics.length) return [];
    const properties = [...new Set(diagnostics.map((entry) => entry.property))].slice(0, 6);
    return [{
        severity: 'error',
        code: 'uncompilable-styles',
        message: `${diagnostics.length} style values could not be compiled to CSS and were dropped (${properties.join(', ')}). Sizes are stored as { size, unit }; a record the compiler does not recognize renders as the element's default.`,
        entries: diagnostics.slice(0, 6),
    }];
}

// 2. Classes on real elements that no stylesheet defines. The author named a design that never
//    arrived, which is exactly how a page reads as "a pile of containers".
export function inertClassHooks(nodes = [], cssText = '') {
    const used = new Set();
    nodes.forEach((node) => classNamesOf(node).forEach((name) => { if (!FRAMEWORK_CLASS.test(name)) used.add(name); }));
    if (!used.size) return [];
    const missing = [...used].filter((name) => !new RegExp(`\\.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(cssText));
    if (!missing.length) return [];
    return [{
        severity: 'error',
        code: 'inert-class-hooks',
        message: `${missing.length} class hook(s) are set on elements but defined by no stylesheet (${missing.slice(0, 8).join(', ')}). Either write their rules (set_custom_css) or remove the class.`,
        classes: missing.slice(0, 12),
    }];
}

// 3. A text primitive carrying a surface and a fixed box: the element is drawing a badge, a swatch
//    or a tile with type, so its label clips to a single character and the inspector shows a
//    paragraph where the design wants a shape.
export function glyphAsGraphic(nodes = []) {
    const flagged = [];
    nodes.forEach((node) => {
        if (!TEXT_TYPES.has(node.type)) return;
        const base = baseOf(node);
        const fill = fillOf(base);
        if (!fill) return;
        const box = fixedBoxOf(base);
        if (!box || box.width > 120 || box.height > 120) return;
        flagged.push({ id: node.id, type: node.type, text: String(node.settings?.text || '').slice(0, 40), fill, ...box });
    });
    return flagged.length ? [{
        severity: 'warning',
        code: 'glyph-as-graphic',
        message: `${flagged.length} text element(s) are being used as shapes: they carry a fill and a fixed ${flagged[0].width}×${flagged[0].height}px box, so long labels clip. Use a Frame with a text child, or drop the fixed box.`,
        elements: flagged.slice(0, 8),
    }] : [];
}

export function auditStore({ nodes = [], cssText = '', diagnostics = [] } = {}) {
    return [
        ...uncompilableStyles(diagnostics),
        ...inertClassHooks(nodes, cssText),
        ...glyphAsGraphic(nodes),
    ];
}
