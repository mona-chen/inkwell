const STATE_PSEUDOS = { hover: 'hover', focus: 'focus', active: 'active' };
const DEVICE_WIDTHS = { desktop: null, tablet: 'tablet', mobile: 'mobile' };
import { usedFonts, fontImportUrl, customFontFaces } from './fonts.js';
import { DEFAULT_THEME_COLORS, DEFAULT_THEME_TYPOGRAPHY, DEFAULT_THEME_SPACING } from './themeDefaults.js';

export default class StyleEngine {
    constructor({ registry, responsive, events } = {}) {
        this.registry = registry;
        this.responsive = responsive;
        this.events = events;
    }

    // Prefixing with the canvas root gives authored values stable precedence over base component
    // styles. The generated sheet is appended after the canvas vocabulary, so source order keeps
    // explicit element data authoritative.
    selector(id, suffix = '') { return `.ink-canvas-root .ink-el-${CSS.escape(id)}${suffix}`; }

    // Cached map of controlName -> { part, property } for each element type (built from element controls).
    controlMeta(definition) {
        if (!this._metaCache) this._metaCache = new Map();
        if (this._metaCache.has(definition.type)) return this._metaCache.get(definition.type);
        const meta = new Map();
        for (const control of definition.controls || []) {
            if (control.part || control.property) meta.set(control.name, { part: control.part || 'root', property: control.property || control.name });
        }
        this._metaCache.set(definition.type, meta);
        return meta;
    }

    // Resolve a named element part to a descendant selector suffix ('' for the root).
    // Returns null when the part is not declared — the style control is dropped with a warning.
    partSelector(definition, part) {
        if (!part || part === 'root') return '';
        const selector = (definition.selectors || {})[part];
        if (!selector) { console.error(`[Ink Builder] element "${definition.type}" has no part selector for "${part}"; style dropped`); return null; }
        return ` ${selector}`;
    }

    value(value) {
        if (Array.isArray(value)) return value.map((item) => this.value(item)).filter(Boolean).join(', ');
        // Shadow records also have a blur field. They must reach the x/y branch below;
        // only a record without positional axes is a CSS-filter control value.
        if (value && typeof value === 'object' && !('x' in value || 'y' in value) && ['blur', 'brightness', 'contrast', 'saturate', 'hue'].some((key) => key in value)) return `blur(${Number(value.blur) || 0}px) brightness(${Number(value.brightness) || 100}%) contrast(${Number(value.contrast) || 100}%) saturate(${Number(value.saturate) || 100}%) hue-rotate(${Number(value.hue) || 0}deg)`;
        if (value && typeof value === 'object' && 'strokeWidth' in value) return `${Number(value.strokeWidth) || 0}${value.unit || 'px'} ${value.color || 'currentColor'}`;
        if (value && typeof value === 'object' && 'size' in value) return `${value.size}${Object.hasOwn(value, 'unit') ? value.unit : 'px'}`;
        if (value && typeof value === 'object' && ['top', 'right', 'bottom', 'left'].some((side) => side in value)) {
            const unit = value.unit || 'px';
            return ['top', 'right', 'bottom', 'left'].map((side) => `${Number(value[side]) || 0}${unit}`).join(' ');
        }
        if (value && typeof value === 'object' && ('row' in value || 'column' in value)) {
            const unit = value.unit || 'px'; return `${Number(value.row) || 0}${unit} ${Number(value.column) || 0}${unit}`;
        }
        if (value && typeof value === 'object' && ('x' in value || 'y' in value)) {
            const unit = value.unit || 'px';
            return `${value.inset ? 'inset ' : ''}${Number(value.x) || 0}${unit} ${Number(value.y) || 0}${unit} ${Number(value.blur) || 0}${unit} ${Number(value.spread) || 0}${unit} ${value.color || 'rgba(0,0,0,.25)'}`;
        }
        if (value && typeof value === 'object' && ('style' in value || 'width' in value)) {
            const width = typeof value.width === 'object' ? this.value(value.width) : `${Number(value.width) || 0}${value.unit || 'px'}`;
            return `${width} ${value.style || 'solid'} ${value.color || 'currentColor'}`;
        }
        return value;
    }

    declarations(values = {}) {
        return Object.entries(values)
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .map(([property, value]) => `${property}:${property === 'background-image' && typeof value === 'string' && value && !/^(url|linear-gradient|radial-gradient)/.test(value) ? `url("${value.replaceAll('"', '\\"')}")` : this.value(value)};`)
            .join('');
    }

    nodeRules(node) {
        const definition = this.registry.get(node.type);
        const map = definition.styleMap || {};
        const meta = this.controlMeta(definition);
        let css = '';
        for (const device of ['desktop', 'tablet', 'mobile']) {
            const deviceStyles = node.styles?.[device] || {};
            const width = DEVICE_WIDTHS[device] ? this.responsive.breakpoints[DEVICE_WIDTHS[device]] : null;
            for (const state of ['base', 'hover', 'focus', 'active']) {
                const settings = deviceStyles[state] || {};
                if (!Object.keys(settings).length) continue;
                const bySelector = new Map();
                Object.entries(settings).forEach(([key, value]) => {
                    if (value === undefined || value === null || value === '') return;
                    const descriptor = map[key] || {};
                    const control = meta.get(key) || {};
                    let suffix = descriptor.selector;
                    if (suffix === undefined) {
                        const part = descriptor.part || control.part || 'root';
                        suffix = this.partSelector(definition, part);
                        if (suffix === null) return; // declared part has no selector target
                    }
                    const target = bySelector.get(suffix) || {};
                    if (typeof descriptor === 'function') {
                        const extra = descriptor(value, node) || {};
                        Object.assign(bySelector.get(suffix) || target, extra);
                    } else {
                        target[descriptor.property || control.property || key] = typeof descriptor.transform === 'function' ? descriptor.transform(value, node) : value;
                    }
                    bySelector.set(suffix, target);
                });
                const pseudo = STATE_PSEUDOS[state] ? `:${state}` : '';
                bySelector.forEach((values, selector) => {
                    const declarations = this.declarations(values);
                    if (!declarations) return;
                    const rule = `${this.selector(node.id, `${pseudo}${selector}`)}{${declarations}}`;
                    css += width ? `@media(max-width:${width}px){${rule}}` : rule;
                });
            }
        }
        return css;
    }

    motionRules(node) {
        const motion = node.settings?.motion;
        if (!motion || motion.enabled === false || !Array.isArray(motion.keyframes) || motion.keyframes.length < 2) return '';
        const safeId = String(node.id).replace(/[^a-zA-Z0-9_-]/g, '_');
        const name = `ink-motion-${safeId}`;
        const allowed = new Set(['transform', 'opacity', 'filter', 'clip-path', 'background-color', 'color']);
        const frames = motion.keyframes.map((frame, index) => {
            const offset = Number.isFinite(Number(frame.offset)) ? Math.max(0, Math.min(1, Number(frame.offset))) : index / Math.max(1, motion.keyframes.length - 1);
            const declarations = Object.entries(frame)
                .filter(([property, value]) => property !== 'offset' && allowed.has(property) && value !== null && value !== undefined && value !== '')
                .map(([property, value]) => `${property}:${String(value).replace(/[{}]/g, '')};`).join('');
            return `${Math.round(offset * 10000) / 100}%{${declarations}}`;
        }).join('');
        if (!frames) return '';
        const duration = Math.max(1, Number(motion.duration) || 800);
        const delay = Number(motion.delay) || 0;
        const iterations = motion.iterations === 'infinite' ? 'infinite' : Math.max(1, Number(motion.iterations) || 1);
        const easing = /^[a-z-]+$|^cubic-bezier\([\d.,\s-]+\)$|^steps\([\d,\s-]+\)$/i.test(String(motion.easing || '')) ? motion.easing : 'ease';
        const direction = ['normal', 'reverse', 'alternate', 'alternate-reverse'].includes(motion.direction) ? motion.direction : 'normal';
        const target = `${this.selector(node.id)}${motion.trigger === 'hover' ? ':hover' : ''}`;
        return `@keyframes ${name}{${frames}}body:not(.ink-builder-design) ${target}{animation:${name} ${duration}ms ${easing} ${delay}ms ${iterations} ${direction} both;transform-style:preserve-3d}@media(prefers-reduced-motion:reduce){${this.selector(node.id)}{animation:none!important}}`;
    }

    compile(document) {
        const settings = document.data.settings || {};
        const theme = settings.theme || {};
        const colors = { ...DEFAULT_THEME_COLORS, ...(theme.colors || {}) };
        const typography = { ...DEFAULT_THEME_TYPOGRAPHY, ...(theme.typography || {}) };
        const spacing = { ...DEFAULT_THEME_SPACING, ...(theme.spacing || {}) };
        let css = `:root{--ink-color-primary:${colors.primary};--ink-color-secondary:${colors.secondary};--ink-color-text:${colors.text};--ink-color-accent:${colors.accent};--ink-content-width:${Number(spacing.contentWidth) || DEFAULT_THEME_SPACING.contentWidth}px;--ink-page-gutter:${Number(spacing.pageGutter) || 0}px;--ink-section-gap:${Number(spacing.sectionGap) || 0}px}body{background:${settings.backgroundColor || '#ffffff'};color:var(--ink-color-text);font-family:${typography.fontFamily};font-size:${Number(typography.baseSize) || DEFAULT_THEME_TYPOGRAPHY.baseSize}px;line-height:${Number(typography.lineHeight) || DEFAULT_THEME_TYPOGRAPHY.lineHeight}}.ink-canvas-root{display:flex;flex-direction:column;gap:var(--ink-section-gap);padding-inline:var(--ink-page-gutter);color:inherit}`;
        const visit = (node) => { css += this.nodeRules(node); css += this.motionRules(node); (node.children || []).forEach(visit); };
        document.data.children.forEach(visit);
        css += document.data.settings.customCss || '';
        // Google Fonts: @import must be the first rules in the stylesheet so the font survives
        // published output (the body keeps this style tag; the head is dropped).
        const fonts = usedFonts(document);
        css = customFontFaces(document) + css;
        if (fonts.length) css = fonts.map((family) => `@import url('${fontImportUrl(family)}');`).join('') + css;
        return css;
    }

    mount(targetDocument, document) {
        let style = targetDocument.getElementById('ink-builder-v2-styles');
        if (!style) { style = targetDocument.createElement('style'); style.id = 'ink-builder-v2-styles'; targetDocument.head.appendChild(style); }
        style.textContent = this.compile(document);
        // Load used Google Fonts into the editor iframe so live editing shows them immediately.
        const fonts = usedFonts(document);
        const existing = targetDocument.querySelectorAll('link[data-ink-google-font]');
        const loaded = new Set();
        existing.forEach((link) => { loaded.add(link.dataset.inkFont); link.remove(); });
        fonts.forEach((family) => {
            if (loaded.has(family)) return;
            const link = targetDocument.createElement('link');
            link.rel = 'stylesheet'; link.dataset.inkGoogleFont = ''; link.dataset.inkFont = family;
            link.href = fontImportUrl(family);
            targetDocument.head.appendChild(link);
        });
        return style;
    }
}
