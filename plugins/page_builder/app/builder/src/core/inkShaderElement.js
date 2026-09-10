const presets = ['Aurora', 'Liquid', 'Waves', 'Grain'];
const setting = (name, type, label, extra = {}) => ({ tab: 'content', target: 'settings', section: 'Shader', name, type, label, ...extra });

export default function registerInkShaderElement(registry) {
    registry.register({
        type: 'shader', title: 'Shader', icon: 'gradient', category: 'Effects', acceptsChildren: true, showEmptyView: false,
        defaults: { settings: { preset: 'aurora', colorA: '#171c36', colorB: '#8369d8', colorC: '#8fe3c5', speed: .5, intensity: .7, grain: .06, animate: true, label: 'Shader' }, styles: { base: { width: '100%', height: { size: 420, unit: 'px' }, position: 'relative', overflow: 'hidden', display: 'flex', 'flex-direction': 'column', 'border-radius': { size: 16, unit: 'px' } } }, children: [] },
        selectors: { root: '&', inner: '.ink-el-shader-content' },
        styleMap: Object.fromEntries(['display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap', 'grid-template-columns', 'grid-template-rows'].map((name) => [name, { part: 'inner' }])),
        controls: [
            setting('preset', 'select', 'Preset', { options: presets.map((label) => ({ label, value: label.toLowerCase() })) }),
            setting('colorA', 'color', 'Base'), setting('colorB', 'color', 'Primary'), setting('colorC', 'color', 'Accent'),
            setting('animate', 'switcher', 'Animate', { default: true }),
            setting('speed', 'slider', 'Speed', { min: 0, max: 2, step: .05, default: .5, condition: { animate: true } }),
            setting('intensity', 'slider', 'Intensity', { min: 0, max: 1, step: .01, default: .7 }),
            setting('grain', 'slider', 'Grain', { min: 0, max: .3, step: .01, default: .06 }),
            { tab: 'style', target: 'styles', section: 'Layout', name: '__layout-flow', type: 'layout-flow', label: 'Flow', responsive: true },
            { tab: 'style', target: 'styles', section: 'Layout', name: '__alignment-gap', type: 'alignment-gap', label: 'Layout', hideLabel: true, responsive: true },
            { tab: 'style', target: 'styles', section: 'Appearance', name: 'border-radius', type: 'dimensions', label: 'Corner radius', units: ['px', '%'], responsive: true },
            { tab: 'style', target: 'styles', section: 'Appearance', name: 'opacity', type: 'slider', label: 'Opacity', min: 0, max: 1, step: .01, default: 1, responsive: true },
            { tab: 'advanced', target: 'styles', section: 'Positioning', name: '__positioning', type: 'positioning', label: 'Position', hideLabel: true, responsive: true },
            { tab: 'advanced', target: 'settings', section: 'Custom attributes', name: 'cssClasses', type: 'text', label: 'CSS classes' },
        ],
        render: ({ domDocument }, node) => {
            const root = domDocument.createElement('div'); root.className = 'ink-el-shader';
            const color = (value, fallback) => {
                const raw = String(value || '');
                if (/^#[\da-f]{6}$/i.test(raw)) return raw;
                if (/^#[\da-f]{3}$/i.test(raw)) return '#' + [...raw.slice(1)].map((digit) => digit + digit).join('');
                const rgb = /^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i.exec(raw);
                return rgb ? '#' + rgb.slice(1).map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, '0')).join('') : fallback;
            };
            const values = { ...node.settings, colorA: color(node.settings.colorA, '#171c36'), colorB: color(node.settings.colorB, '#8369d8'), colorC: color(node.settings.colorC, '#8fe3c5') };
            root.dataset.inkShader = JSON.stringify(values);
            root.style.background = `radial-gradient(ellipse at 75% 25%, ${values.colorC}, transparent 65%), radial-gradient(ellipse at 20% 80%, ${values.colorB}, ${values.colorA})`;
            const canvas = domDocument.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
            const content = domDocument.createElement('div'); content.className = 'ink-el-shader-content'; content.dataset.inkChildren = '';
            root.append(canvas, content); return root;
        },
    });
    return registry;
}
