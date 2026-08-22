const STATES = new Set(['hover', 'focus', 'active']);

export default class StyleEngine {
    constructor({ registry, responsive, events } = {}) {
        this.registry = registry;
        this.responsive = responsive;
        this.events = events;
    }

    selector(id, suffix = '') { return `.ink-el-${CSS.escape(id)}${suffix}`; }

    value(value) {
        if (value && typeof value === 'object' && ('brightness' in value || 'contrast' in value || 'saturate' in value)) return `blur(${Number(value.blur) || 0}px) brightness(${Number(value.brightness) || 100}%) contrast(${Number(value.contrast) || 100}%) saturate(${Number(value.saturate) || 100}%) hue-rotate(${Number(value.hue) || 0}deg)`;
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
        const buckets = { base: {}, tablet: {}, mobile: {}, hover: {}, focus: {}, active: {} };
        Object.entries(node.styles || {}).forEach(([bucket, settings]) => {
            if (!buckets[bucket]) buckets[bucket] = {};
            Object.entries(settings || {}).forEach(([key, value]) => {
                const descriptor = map[key] || { property: key };
                if (typeof descriptor === 'function') Object.assign(buckets[bucket], descriptor(value, node) || {});
                else buckets[bucket][descriptor.property || key] = typeof descriptor.transform === 'function' ? descriptor.transform(value, node) : value;
            });
        });
        let css = '';
        Object.entries(buckets).forEach(([bucket, values]) => {
            const declarations = this.declarations(values);
            if (!declarations) return;
            if (STATES.has(bucket)) css += `${this.selector(node.id, `:${bucket}`)}{${declarations}}`;
            else if (bucket === 'base') css += `${this.selector(node.id)}{${declarations}}`;
            else {
                const width = this.responsive.breakpoints[bucket];
                if (width) css += `@media(max-width:${width}px){${this.selector(node.id)}{${declarations}}}`;
            }
        });
        return css;
    }

    compile(document) {
        const settings = document.data.settings || {};
        const theme = settings.theme || {};
        const colors = {
            primary: '#6ec1e4', secondary: '#54595f', text: '#7a7a7a', accent: '#61ce70',
            ...(theme.colors || {}),
        };
        const typography = { fontFamily: 'Inter,ui-sans-serif,system-ui,sans-serif', baseSize: 16, lineHeight: 1.5, ...(theme.typography || {}) };
        const spacing = { contentWidth: 1140, pageGutter: 10, sectionGap: 0, ...(theme.spacing || {}) };
        let css = `:root{--ink-color-primary:${colors.primary};--ink-color-secondary:${colors.secondary};--ink-color-text:${colors.text};--ink-color-accent:${colors.accent};--ink-content-width:${Number(spacing.contentWidth) || 1140}px;--ink-page-gutter:${Number(spacing.pageGutter) || 0}px;--ink-section-gap:${Number(spacing.sectionGap) || 0}px}body{background:${settings.backgroundColor || '#ffffff'};color:var(--ink-color-text);font-family:${typography.fontFamily};font-size:${Number(typography.baseSize) || 16}px;line-height:${Number(typography.lineHeight) || 1.5}}.ink-canvas-root{display:flex;flex-direction:column;gap:var(--ink-section-gap);padding-inline:var(--ink-page-gutter)}`;
        const visit = (node) => { css += this.nodeRules(node); (node.children || []).forEach(visit); };
        document.data.children.forEach(visit);
        css += document.data.settings.customCss || '';
        return css;
    }

    mount(targetDocument, document) {
        let style = targetDocument.getElementById('ink-builder-v2-styles');
        if (!style) { style = targetDocument.createElement('style'); style.id = 'ink-builder-v2-styles'; targetDocument.head.appendChild(style); }
        style.textContent = this.compile(document);
        return style;
    }
}
