const make = (document, tag, className = '', text = null) => {
    const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node;
};
import { renderIcon } from './icons.js';
const icon = (document, name, className = '') => renderIcon(document, name, className);
const url = (value) => typeof value === 'object' ? value.url : value;

const spacing = [
    { tab: 'advanced', target: 'styles', section: 'Spacing', name: 'margin', type: 'dimensions', label: 'Margin', units: ['px', 'rem', '%'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Spacing', name: 'padding', type: 'dimensions', label: 'Padding', units: ['px', 'rem', '%'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'width', type: 'size', label: 'Width', units: ['px', '%', 'vw'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'min-width', type: 'size', label: 'Minimum width', units: ['px', '%', 'vw', 'rem'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'max-width', type: 'size', label: 'Maximum width', units: ['px', '%', 'vw', 'rem'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'height', type: 'size', label: 'Height', units: ['px', '%', 'vh'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'min-height', type: 'size', label: 'Minimum height', units: ['px', '%', 'vh'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'max-height', type: 'size', label: 'Maximum height', units: ['px', '%', 'vh'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'aspect-ratio', type: 'text', label: 'Aspect ratio', placeholder: '16 / 9', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'overflow', type: 'select', label: 'Overflow', options: ['visible', 'hidden', 'auto', 'scroll', 'clip'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Interaction', name: 'cursor', type: 'select', label: 'Cursor', options: ['auto', 'default', 'pointer', 'text', 'grab', 'grabbing', 'crosshair', 'move', 'not-allowed', 'zoom-in', 'zoom-out', 'none'] },
];
const vectorAdvanced = [
    { tab: 'advanced', target: 'styles', section: 'Positioning', name: 'position', type: 'select', label: 'Position', options: ['static', 'relative', 'absolute', 'fixed', 'sticky'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Positioning', name: 'top', type: 'size', label: 'Top', units: ['px', '%', 'vh', 'rem'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Positioning', name: 'right', type: 'size', label: 'Right', units: ['px', '%', 'vw', 'rem'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Positioning', name: 'bottom', type: 'size', label: 'Bottom', units: ['px', '%', 'vh', 'rem'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Positioning', name: 'left', type: 'size', label: 'Left', units: ['px', '%', 'vw', 'rem'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Positioning', name: 'z-index', type: 'number', label: 'Z-index', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Transform', name: 'translate', type: 'text', label: 'Translate', placeholder: '0px 0px', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Transform', name: 'rotate', type: 'size', label: 'Rotate', units: ['deg', 'turn'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Transform', name: 'scale', type: 'number', label: 'Scale', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Effects', name: 'opacity', type: 'slider', label: 'Opacity', min: 0, max: 1, step: 0.05, responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Effects', name: 'filter', type: 'css-filters', label: 'CSS filters' },
    { tab: 'advanced', target: 'settings', section: 'Motion', name: 'motion', type: 'motion', label: 'Animation', description: 'Native keyframes run in Preview and published pages; Design mode stays stable and editable.' },
];

// Single typography popover (Ink) writing to the element's style bucket.
const typographyControls = {
    tab: 'style', target: 'styles', section: 'Typography', name: 'typography', type: 'typography', label: 'Typography',
};
const alignmentControl = {
    tab: 'style', target: 'styles', section: 'Typography', name: 'text-align', type: 'choose', label: 'Alignment',
    options: [{ value: 'left', icon: 'format_align_left' }, { value: 'center', icon: 'format_align_center' }, { value: 'right', icon: 'format_align_right' }, { value: 'justify', icon: 'format_align_justify' }],
    responsive: true,
};

const items = (name = 'items', fields = []) => ({ tab: 'content', section: 'Items', name, type: 'repeater', label: 'Items', titleField: fields[0]?.name, fields });
const textField = (name, label, type = 'text') => ({ name, label, type });

// Ink section structure presets: each entry is a set of column widths (%).
const STRUCTURE_PRESETS = {
    '50,50': '2 columns · 50/50',
    '33,33,33': '3 columns · equal',
    '25,25,25,25': '4 columns · equal',
    '20,20,20,20,20': '5 columns · equal',
    '60,40': '2 columns · 60/40',
    '40,60': '2 columns · 40/60',
    '66,34': '2 columns · 66/34',
    '34,66': '2 columns · 34/66',
    '25,50,25': '3 columns · 25/50/25',
    '33,67': '2 columns · 33/67',
};
const structureChoices = Object.entries(STRUCTURE_PRESETS).map(([value, label]) => ({ value, label }));

function register(registry, definition) { registry.register({ category: 'General', controls: [], defaults: { settings: {}, styles: { base: {} } }, ...definition }); }

// Renders a section/container that can be boxed (inner content limited to the site
// content width) or full-width/stretched. The inner wrapper is the drop target.
function renderShell(domDocument, node, rootClass, tag = 'div') {
    const root = make(domDocument, node.settings.tag || tag, rootClass);
    const layout = node.settings.layout || 'boxed';
    root.classList.add(`is-${layout}`);
    const inner = make(domDocument, 'div', `${rootClass}-inner`);
    inner.dataset.inkChildren = '';
    root.appendChild(inner);
    return root;
}

export default function registerInkElements(registry) {
    register(registry, {
        type: 'site-part', title: 'Site Part', icon: 'web_asset', category: 'Site', acceptsChildren: true,
        defaults: { settings: { partKey: 'header' }, styles: { base: {} }, children: [] },
        controls: [
            { tab: 'content', section: 'Site Part', name: 'partKey', type: 'select', label: 'Global part', options: [{ value: 'header', label: 'Header' }, { value: 'footer', label: 'Footer' }] },
            { tab: 'style', target: 'styles', section: 'Background', name: 'background', type: 'background', label: 'Background' },
            { tab: 'style', target: 'styles', section: 'Border', name: 'border', type: 'border', label: 'Border' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = domDocument.createElement(node.settings.partKey === 'footer' ? 'footer' : 'header');
            root.className = 'ink-el-site-part';
            root.dataset.inkChildren = '';
            root.dataset.inkSitePart = node.settings.partKey || 'header';
            // Captured sites commonly scope every rule below a generated page-root class.
            // Keep that class as a transparent ancestor of the imported header/footer so its
            // selectors continue to match, without letting page-root min-height/flex rules turn
            // the global part itself into another page-sized layout box.
            const scopeClasses = String(node.settings.scopeClasses || '').split(/\s+/)
                .filter((name) => /^[a-zA-Z_][\w-]*$/.test(name));
            scopeClasses.forEach((name) => root.classList.add(name));
            if (scopeClasses.length) {
                root.style.setProperty('display', 'contents', 'important');
                root.dataset.inkSitePartScope = 'source';
            }
            return root;
        },
    });
    // Section: full-width bar, optional inner content width, vertical stack, accepts columns.
    register(registry, {
        type: 'section', title: 'Section', icon: 'crop_landscape', category: 'Layout', legacy: true, acceptsChildren: true,
        defaults: {
            settings: { tag: 'section', layout: 'boxed', structure: '50,50' },
            styles: { base: { display: 'flex', 'flex-direction': 'column', width: '100%', padding: { top: 35, right: 10, bottom: 35, left: 10, unit: 'px' }, gap: { row: 20, column: 20, unit: 'px' } } },
            children: [],
        },
        controls: [
            { tab: 'content', section: 'Layout', name: 'layout', type: 'choose', label: 'Content width', options: [{ value: 'boxed', label: 'Boxed' }, { value: 'full', label: 'Full width' }, { value: 'stretched', label: 'Stretch' }] },
            { tab: 'content', section: 'Layout', name: 'structure', type: 'structure', label: 'Columns structure', options: structureChoices },
            { tab: 'content', section: 'Layout', name: 'tag', type: 'select', label: 'HTML tag', options: ['section', 'main', 'header', 'footer', 'article', 'div'] },
            { tab: 'content', target: 'styles', section: 'Layout', name: 'flex-direction', type: 'choose', label: 'Direction', options: ['row', 'column'], responsive: true },
            { tab: 'content', target: 'styles', section: 'Layout', name: 'gap', type: 'gaps', label: 'Row / column gap', units: ['px', 'rem', '%'], responsive: true },
            { tab: 'content', target: 'styles', section: 'Layout', name: 'justify-content', type: 'select', label: 'Justify', options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'], responsive: true },
            { tab: 'content', target: 'styles', section: 'Layout', name: 'align-items', type: 'select', label: 'Align', options: ['stretch', 'flex-start', 'center', 'flex-end'], responsive: true },
            { tab: 'style', target: 'styles', section: 'Background', name: 'background', type: 'background', label: 'Background' },
            { tab: 'style', target: 'styles', section: 'Border', name: 'border', type: 'border', label: 'Border' },
            { tab: 'style', target: 'styles', section: 'Border', name: 'border-radius', type: 'dimensions', label: 'Radius', units: ['px', 'rem', '%'], responsive: true },
            ...spacing,
        ],
        render: ({ domDocument }, node) => renderShell(domDocument, node, 'ink-el-section', 'section'),
    });

    // Columns: a flex row that only accepts columns. Structure presets drive widths.
    register(registry, {
        type: 'columns', title: 'Columns', icon: 'view_column', category: 'Layout', legacy: true, acceptsChildren: ['column'],
        acceptsChild: (parent, child) => child.type === 'column',
        defaults: { settings: { structure: '50,50' }, styles: { base: {} }, children: [] },
        controls: [
            { tab: 'content', section: 'Layout', name: 'structure', type: 'structure', label: 'Columns structure', options: structureChoices },
            { tab: 'content', target: 'styles', section: 'Layout', name: 'gap', type: 'gaps', label: 'Column / row gap', units: ['px', 'rem', '%'], responsive: true },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-columns');
            const structure = (node.settings.structure || '50,50').split(',').length === (node.children || []).length ? node.settings.structure : '50,50';
            root.classList.add(`is-${structure.split(',').join('-')}`);
            root.dataset.inkChildren = '';
            return root;
        },
        // Apply per-column widths as inline flex-basis (Elementor-style). Inline styles beat
        // the preset classes, so arbitrary structures like "37,63" resize correctly.
        mount: ({ element, node }) => {
            const widths = String(node.settings.structure || '50,50').split(',').map(Number);
            Array.from(element.querySelectorAll(':scope > .ink-el-column')).forEach((column, index) => {
                if (widths[index]) column.style.flexBasis = `${widths[index]}%`;
            });
        },
    });

    // Column: a vertical stack container with a 10px gutter padding.
    register(registry, {
        type: 'column', title: 'Column', icon: 'view_week', category: 'Layout', legacy: true, acceptsChildren: true,
        defaults: { settings: {}, styles: { base: { display: 'flex', 'flex-direction': 'column', gap: { row: 20, column: 20, unit: 'px' }, padding: { top: 10, right: 10, bottom: 10, left: 10, unit: 'px' }, 'align-items': 'stretch' } }, children: [] },
        controls: [
            { tab: 'content', target: 'styles', section: 'Layout', name: 'flex-grow', type: 'number', label: 'Grow', responsive: true },
            { tab: 'content', target: 'styles', section: 'Layout', name: 'flex-basis', type: 'size', label: 'Basis', units: ['px', '%'], responsive: true },
            { tab: 'content', target: 'styles', section: 'Layout', name: 'gap', type: 'gaps', label: 'Widgets gap', units: ['px', 'rem'], responsive: true },
            { tab: 'style', target: 'styles', section: 'Background', name: 'background', type: 'background', label: 'Background' },
            { tab: 'style', target: 'styles', section: 'Border', name: 'border', type: 'border', label: 'Border' },
            ...spacing,
        ],
        render: ({ domDocument }) => { const root = make(domDocument, 'div', 'ink-el-column'); root.dataset.inkChildren = ''; return root; },
    });

    register(registry, {
        type: 'text-editor', title: 'Text Editor', icon: 'notes',
        defaults: { settings: { html: '<p>Add your text here. Edit it from the panel.</p>' }, styles: { base: {} } },
        controls: [{ tab: 'content', section: 'Content', name: 'html', type: 'wysiwyg', label: 'Text editor' }, typographyControls, alignmentControl, ...spacing],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-text-editor');
            // Canonical value is { json, html } (TipTap); legacy pages carry a raw HTML string.
            root.innerHTML = typeof node.settings.html === 'string' ? (node.settings.html || '') : (node.settings.html?.html || '');
            return root;
        },
    });
    register(registry, {
        type: 'html', title: 'HTML', icon: 'code',
        defaults: { settings: { html: '<div>Custom HTML</div>' }, styles: { base: {} } },
        controls: [{ tab: 'content', section: 'HTML', name: 'html', type: 'code', label: 'HTML' }, ...spacing],
        render: ({ domDocument }, node) => { const root = make(domDocument, 'div', 'ink-el-html'); root.innerHTML = node.settings.html || ''; return root; },
    });
    register(registry, {
        type: 'link', title: 'Link', icon: 'link', category: 'Basic',
        defaults: { settings: { text: 'Link', url: '#', target: '', rel: '' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Link', name: 'text', type: 'text', label: 'Text' },
            { tab: 'content', section: 'Link', name: 'url', type: 'url', label: 'URL' },
            { tab: 'content', section: 'Link', name: 'target', type: 'select', label: 'Open in', options: [{ value: '', label: 'Same window' }, { value: '_blank', label: 'New window' }] },
            { tab: 'content', section: 'Link', name: 'rel', type: 'text', label: 'Relationship' },
            typographyControls, alignmentControl,
            { tab: 'style', target: 'styles', section: 'Link', name: 'color', type: 'color', label: 'Color', states: true },
            { tab: 'style', target: 'styles', section: 'Link', name: 'background', type: 'background', label: 'Background' },
            { tab: 'style', target: 'styles', section: 'Link', name: 'text-shadow', type: 'text-shadow', label: 'Text shadow' },
            { tab: 'style', target: 'styles', section: 'Link', name: '-webkit-text-stroke', type: 'text-stroke', label: 'Text stroke' },
            { tab: 'style', target: 'styles', section: 'Link', name: 'mix-blend-mode', type: 'select', label: 'Blend mode', options: ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion'] },
            ...spacing,
        ],
        inlineEditable: { setting: 'text' },
        render: ({ domDocument }, node) => { const root = make(domDocument, 'a', 'ink-el-link', node.settings.text || ''); root.href = node.settings.url || '#'; if (node.settings.target) root.target = node.settings.target; if (node.settings.rel) root.rel = node.settings.rel; return root; },
    });
    register(registry, {
        type: 'inline-text', title: 'Inline Text', icon: 'text_fields', category: 'Basic',
        defaults: { settings: { tag: 'span', text: 'Inline text' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Text', name: 'text', type: 'text', label: 'Text' },
            { tab: 'content', section: 'Text', name: 'tag', type: 'select', label: 'Tag', options: ['span', 'strong', 'em', 'small', 'mark', 'code'] },
            typographyControls,
            { tab: 'style', target: 'styles', section: 'Text', name: 'color', type: 'color', label: 'Color', states: true },
            { tab: 'style', target: 'styles', section: 'Text', name: 'background', type: 'background', label: 'Background' },
            { tab: 'style', target: 'styles', section: 'Text', name: 'text-shadow', type: 'text-shadow', label: 'Text shadow' },
            { tab: 'style', target: 'styles', section: 'Text', name: '-webkit-text-stroke', type: 'text-stroke', label: 'Text stroke' },
            { tab: 'style', target: 'styles', section: 'Text', name: 'mix-blend-mode', type: 'select', label: 'Blend mode', options: ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion'] },
            ...spacing,
        ],
        inlineEditable: { setting: 'text' },
        render: ({ domDocument }, node) => make(domDocument, ['span', 'strong', 'em', 'small', 'mark', 'code'].includes(node.settings.tag) ? node.settings.tag : 'span', 'ink-el-inline-text', node.settings.text || ''),
    });
    register(registry, {
        type: 'line-break', title: 'Line Break', icon: 'keyboard_return', category: 'Basic',
        defaults: { settings: {}, styles: { base: {} } }, controls: [...spacing],
        render: ({ domDocument }) => domDocument.createElement('br'),
    });
    register(registry, {
        type: 'figure', title: 'Figure', icon: 'photo', category: 'Media', acceptsChildren: true,
        defaults: { settings: {}, styles: { base: {} }, children: [] },
        controls: [{ tab: 'style', target: 'styles', section: 'Layout', name: 'display', type: 'select', label: 'Display', options: ['block', 'flex', 'grid'] }, ...spacing],
        render: ({ domDocument }) => { const root = domDocument.createElement('figure'); root.dataset.inkChildren = ''; return root; },
    });
    register(registry, {
        type: 'canvas', title: 'Canvas', icon: 'draw', category: 'Media',
        defaults: { settings: { width: 300, height: 150, label: 'Interactive canvas' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Canvas', name: 'width', type: 'number', label: 'Bitmap width' },
            { tab: 'content', section: 'Canvas', name: 'height', type: 'number', label: 'Bitmap height' },
            { tab: 'content', section: 'Canvas', name: 'label', type: 'text', label: 'Accessible label' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => { const root = domDocument.createElement('canvas'); root.width = Number(node.settings.width) || 300; root.height = Number(node.settings.height) || 150; root.setAttribute('aria-label', node.settings.label || ''); return root; },
    });
    const nativeContainer = (type, title, tag, category, controls = []) => register(registry, {
        type, title, icon: type.includes('list') ? 'format_list_bulleted' : type === 'form' ? 'dynamic_form' : 'html', category,
        acceptsChildren: true,
        defaults: { settings: {}, styles: { base: {} }, children: [] },
        controls: [...controls, { tab: 'style', target: 'styles', section: 'Layout', name: 'display', type: 'select', label: 'Display', options: ['block', 'flex', 'grid', 'inline', 'inline-flex'] }, ...spacing],
        render: ({ domDocument }) => { const root = domDocument.createElement(tag); root.dataset.inkChildren = ''; return root; },
    });
    nativeContainer('picture', 'Responsive Picture', 'picture', 'Media');
    nativeContainer('form', 'Form', 'form', 'Form', [
        { tab: 'content', section: 'Form', name: 'action', type: 'url', label: 'Action' },
        { tab: 'content', section: 'Form', name: 'method', type: 'select', label: 'Method', options: ['get', 'post'] },
    ]);
    nativeContainer('unordered-list', 'Unordered List', 'ul', 'Basic');
    nativeContainer('ordered-list', 'Ordered List', 'ol', 'Basic');
    nativeContainer('list-item', 'List Item', 'li', 'Basic');
    register(registry, {
        type: 'media-source', title: 'Media Source', icon: 'perm_media', category: 'Media',
        defaults: { settings: { src: '', srcset: '', type: '', media: '' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Source', name: 'src', type: 'media', label: 'Source URL' },
            { tab: 'content', section: 'Source', name: 'srcset', type: 'textarea', label: 'Responsive sources' },
            { tab: 'content', section: 'Source', name: 'type', type: 'text', label: 'MIME type' },
            { tab: 'content', section: 'Source', name: 'media', type: 'text', label: 'Media query' },
        ],
        render: ({ domDocument }, node) => { const root = domDocument.createElement('source'); ['src', 'srcset', 'type', 'media'].forEach((name) => { if (node.settings[name]) root.setAttribute(name, node.settings[name]); }); return root; },
    });
    register(registry, {
        type: 'input', title: 'Input', icon: 'input', category: 'Form',
        defaults: { settings: { inputType: 'text', name: '', placeholder: '', value: '' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Field', name: 'inputType', type: 'select', label: 'Type', options: ['text', 'email', 'tel', 'url', 'number', 'password', 'search', 'checkbox', 'radio', 'hidden', 'submit'] },
            { tab: 'content', section: 'Field', name: 'name', type: 'text', label: 'Name' },
            { tab: 'content', section: 'Field', name: 'placeholder', type: 'text', label: 'Placeholder' },
            { tab: 'content', section: 'Field', name: 'value', type: 'text', label: 'Value' },
            typographyControls, { tab: 'style', target: 'styles', section: 'Field', name: 'background', type: 'background', label: 'Background' }, { tab: 'style', target: 'styles', section: 'Field', name: 'border', type: 'border', label: 'Border' }, ...spacing,
        ],
        render: ({ domDocument }, node) => { const root = domDocument.createElement('input'); root.type = node.settings.inputType || 'text'; root.name = node.settings.name || ''; root.placeholder = node.settings.placeholder || ''; root.value = node.settings.value || ''; return root; },
    });
    register(registry, {
        type: 'textarea', title: 'Textarea', icon: 'notes', category: 'Form',
        defaults: { settings: { name: '', placeholder: '', text: '' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Field', name: 'name', type: 'text', label: 'Name' },
            { tab: 'content', section: 'Field', name: 'placeholder', type: 'text', label: 'Placeholder' },
            { tab: 'content', section: 'Field', name: 'text', type: 'textarea', label: 'Default value' },
            typographyControls, { tab: 'style', target: 'styles', section: 'Field', name: 'background', type: 'background', label: 'Background' }, { tab: 'style', target: 'styles', section: 'Field', name: 'border', type: 'border', label: 'Border' }, ...spacing,
        ],
        render: ({ domDocument }, node) => { const root = domDocument.createElement('textarea'); root.name = node.settings.name || ''; root.placeholder = node.settings.placeholder || ''; root.value = node.settings.text || ''; return root; },
    });
    register(registry, {
        type: 'label', title: 'Field Label', icon: 'label', category: 'Form',
        defaults: { settings: { text: 'Label', forId: '' }, styles: { base: {} } },
        controls: [{ tab: 'content', section: 'Label', name: 'text', type: 'text', label: 'Text' }, { tab: 'content', section: 'Label', name: 'forId', type: 'text', label: 'Field ID' }, typographyControls, ...spacing],
        inlineEditable: { setting: 'text' },
        render: ({ domDocument }, node) => { const root = make(domDocument, 'label', 'ink-el-label', node.settings.text || ''); if (node.settings.forId) root.htmlFor = node.settings.forId; return root; },
    });
    const appendSafeSvgMarkup = (domDocument, root, markup) => {
        if (!markup || typeof markup !== 'string') return;
        const parser = new domDocument.defaultView.DOMParser();
        const parsed = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`, 'image/svg+xml');
        const source = parsed.documentElement;
        const blocked = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'link', 'style']);
        [...source.querySelectorAll('*')].forEach((element) => {
            if (blocked.has(element.localName.toLowerCase())) { element.remove(); return; }
            [...element.attributes].forEach((attribute) => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value.trim().toLowerCase();
                if (name.startsWith('on') || ((name === 'href' || name === 'xlink:href') && value.startsWith('javascript:'))) element.removeAttribute(attribute.name);
            });
        });
        [...source.childNodes].forEach((child) => root.appendChild(domDocument.importNode(child, true)));
    };
    const svgElement = (type, title, tag, controls = [], acceptsChildren = false, internal = true) => register(registry, {
        type, title, icon: 'polyline', category: 'Vector', acceptsChildren, internal,
        defaults: { settings: {}, styles: { base: {} }, ...(acceptsChildren ? { children: [] } : {}) },
        controls: [...controls, { tab: 'style', target: 'styles', section: 'Vector', name: 'fill', type: 'color', label: 'Fill' }, { tab: 'style', target: 'styles', section: 'Vector', name: 'stroke', type: 'color', label: 'Stroke' }, ...spacing, ...vectorAdvanced],
        render: ({ domDocument }, node) => { const root = domDocument.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(node.settings || {}).forEach(([name, value]) => { if (!['cssClasses', 'cssId', 'markup'].includes(name) && value !== '' && value != null) root.setAttribute(name, String(value)); }); if (tag === 'svg') appendSafeSvgMarkup(domDocument, root, node.settings.markup); if (acceptsChildren) root.dataset.inkChildren = ''; return root; },
    });
    svgElement('svg', 'SVG', 'svg', [
        { tab: 'content', section: 'Vector', name: 'markup', type: 'code', label: 'SVG markup' },
        { tab: 'content', section: 'Vector', name: 'viewBox', type: 'text', label: 'View box' },
        { tab: 'content', section: 'Vector', name: 'preserveAspectRatio', type: 'select', label: 'Fit', options: [{ value: 'xMidYMid meet', label: 'Contain' }, { value: 'xMidYMid slice', label: 'Cover' }, { value: 'none', label: 'Stretch' }] },
        { tab: 'content', section: 'Vector', name: 'width', type: 'text', label: 'Width' },
        { tab: 'content', section: 'Vector', name: 'height', type: 'text', label: 'Height' },
        { tab: 'content', section: 'Accessibility', name: 'aria-label', type: 'text', label: 'Accessible name' },
        { tab: 'content', section: 'Accessibility', name: 'role', type: 'select', label: 'Role', options: [{ value: '', label: 'Automatic' }, { value: 'img', label: 'Image' }, { value: 'presentation', label: 'Decorative' }] },
        { tab: 'advanced', section: 'Vector editing', name: 'vectorEditing', type: 'switcher', label: 'Edit internal geometry' },
    ], true, false);
    svgElement('svg-path', 'SVG Path', 'path', [{ tab: 'content', section: 'Path', name: 'd', type: 'code', label: 'Path data' }, { tab: 'content', section: 'Path', name: 'stroke-width', type: 'number', label: 'Stroke width' }]);
    svgElement('svg-use', 'SVG Use', 'use', [{ tab: 'content', section: 'Reference', name: 'href', type: 'text', label: 'Reference' }]);
    svgElement('svg-defs', 'SVG Definitions', 'defs', [], true);
    svgElement('svg-linear-gradient', 'SVG Linear Gradient', 'linearGradient', [{ tab: 'content', section: 'Gradient', name: 'id', type: 'text', label: 'ID' }], true);
    svgElement('svg-stop', 'SVG Gradient Stop', 'stop', [{ tab: 'content', section: 'Stop', name: 'offset', type: 'text', label: 'Offset' }, { tab: 'content', section: 'Stop', name: 'stop-color', type: 'color', label: 'Color' }]);
    svgElement('svg-circle', 'SVG Circle', 'circle', [{ tab: 'content', section: 'Circle', name: 'cx', type: 'number', label: 'Center X' }, { tab: 'content', section: 'Circle', name: 'cy', type: 'number', label: 'Center Y' }, { tab: 'content', section: 'Circle', name: 'r', type: 'number', label: 'Radius' }]);
    svgElement('svg-group', 'SVG Group', 'g', [], true);
    svgElement('svg-rect', 'SVG Rectangle', 'rect', [{ tab: 'content', section: 'Rectangle', name: 'x', type: 'number', label: 'X' }, { tab: 'content', section: 'Rectangle', name: 'y', type: 'number', label: 'Y' }, { tab: 'content', section: 'Rectangle', name: 'width', type: 'text', label: 'Width' }, { tab: 'content', section: 'Rectangle', name: 'height', type: 'text', label: 'Height' }]);
    svgElement('svg-clip-path', 'SVG Clip Path', 'clipPath', [], true);
    svgElement('svg-pattern', 'SVG Pattern', 'pattern', [{ tab: 'content', section: 'Pattern', name: 'width', type: 'text', label: 'Width' }, { tab: 'content', section: 'Pattern', name: 'height', type: 'text', label: 'Height' }], true);
    svgElement('svg-filter', 'SVG Filter', 'filter', [{ tab: 'content', section: 'Filter', name: 'id', type: 'text', label: 'ID' }], true);
    svgElement('svg-image', 'SVG Image', 'image', [{ tab: 'content', section: 'Image', name: 'href', type: 'media', label: 'Image URL' }]);
    svgElement('svg-fe-color-matrix', 'SVG Color Matrix', 'feColorMatrix', [{ tab: 'content', section: 'Filter', name: 'values', type: 'textarea', label: 'Matrix values' }]);
    svgElement('svg-fe-blend', 'SVG Blend', 'feBlend', [{ tab: 'content', section: 'Filter', name: 'mode', type: 'select', label: 'Blend mode', options: ['normal', 'multiply', 'screen', 'darken', 'lighten'] }]);
    svgElement('svg-fe-flood', 'SVG Flood', 'feFlood', [{ tab: 'content', section: 'Filter', name: 'flood-color', type: 'color', label: 'Color' }]);
    svgElement('svg-fe-offset', 'SVG Offset', 'feOffset', [{ tab: 'content', section: 'Filter', name: 'dx', type: 'number', label: 'X offset' }, { tab: 'content', section: 'Filter', name: 'dy', type: 'number', label: 'Y offset' }]);
    svgElement('svg-fe-gaussian-blur', 'SVG Gaussian Blur', 'feGaussianBlur', [{ tab: 'content', section: 'Filter', name: 'stdDeviation', type: 'number', label: 'Deviation' }]);
    svgElement('svg-fe-composite', 'SVG Composite', 'feComposite', [{ tab: 'content', section: 'Filter', name: 'operator', type: 'select', label: 'Operator', options: ['over', 'in', 'out', 'atop', 'xor', 'arithmetic'] }]);
    register(registry, {
        type: 'imported-element', title: 'Imported DOM Element', icon: 'data_object', category: 'Imported',
        acceptsChildren: true, preserveMarkup: true,
        defaults: { settings: { tag: 'div', attributesJson: '{}', textSegments: [''] }, styles: { base: {} }, children: [] },
        controls: [
            { tab: 'content', section: 'Element', name: 'tag', type: 'text', label: 'HTML tag' },
            { tab: 'content', section: 'Element', name: 'textSegments', type: 'code', label: 'Text segments' },
            { tab: 'advanced', section: 'Attributes', name: 'attributesJson', type: 'code', label: 'HTML attributes' },
            typographyControls,
            { tab: 'style', target: 'styles', section: 'Background', name: 'background', type: 'background', label: 'Background' },
            { tab: 'style', target: 'styles', section: 'Border', name: 'border', type: 'border', label: 'Border' },
            { tab: 'style', target: 'styles', section: 'Effects', name: 'box-shadow', type: 'box-shadow', label: 'Box shadow' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const requested = String(node.settings.tag || 'div').toLowerCase();
            const tag = /^[a-z][a-z0-9-]*$/.test(requested) && !['html', 'head', 'body', 'script', 'style', 'link', 'meta', 'base'].includes(requested) ? requested : 'div';
            const namespace = String(node.settings.namespace || 'http://www.w3.org/1999/xhtml');
            const root = namespace === 'http://www.w3.org/1999/xhtml' ? domDocument.createElement(tag) : domDocument.createElementNS(namespace, tag);
            let attributes = node.settings.attributesJson || {};
            if (typeof attributes === 'string') { try { attributes = JSON.parse(attributes); } catch (_) { attributes = {}; } }
            Object.entries(attributes || {}).forEach(([name, value]) => {
                if (!name || /^on/i.test(name) || ['srcdoc'].includes(name.toLowerCase()) || value == null) return;
                try { root.setAttribute(name, String(value)); } catch (_) {}
            });
            return root;
        },
        appendChildren: ({ element, node, create, domDocument }) => {
            let segments = node.settings.textSegments || [];
            if (typeof segments === 'string') { try { segments = JSON.parse(segments); } catch (_) { segments = [segments]; } }
            const children = node.children || [];
            const appendText = (value) => { if (value != null && value !== '') element.appendChild(domDocument.createTextNode(String(value))); };
            appendText(segments[0]);
            children.forEach((child, index) => { element.appendChild(create(child)); appendText(segments[index + 1]); });
        },
    });
    register(registry, {
        type: 'icon', title: 'Icon', icon: 'star',
        defaults: { settings: { icon: 'star', label: 'Star', rotate: 0 }, styles: { base: { color: '#6ec1e4' } } },
        controls: [
            { tab: 'content', section: 'Icon', name: 'icon', type: 'icon', label: 'Icon' },
            { tab: 'content', section: 'Icon', name: 'label', type: 'text', label: 'Accessible label' },
            { tab: 'content', section: 'Icon', name: 'rotate', type: 'slider', label: 'Rotate', min: -360, max: 360 },
            { tab: 'style', target: 'styles', section: 'Icon', name: 'color', type: 'color', label: 'Color', states: true },
            { tab: 'style', target: 'styles', section: 'Icon', name: 'font-size', type: 'size', label: 'Size', units: ['px', 'rem'], responsive: true },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = icon(domDocument, node.settings.icon, 'ink-el-icon'); root.setAttribute('aria-label', node.settings.label || '');
            if (Number(node.settings.rotate)) root.style.transform = `rotate(${Number(node.settings.rotate)}deg)`;
            return root;
        },
    });
    ['icon-box', 'image-box'].forEach((type) => register(registry, {
        type: type === 'icon-box' ? 'icon-box' : 'image-box',
        title: type === 'icon-box' ? 'Icon Box' : 'Image Box',
        icon: type === 'icon-box' ? 'featured_play_list' : 'image',
        defaults: { settings: { title: 'Feature title', description: 'A short description that explains this feature.', icon: 'auto_awesome', image: '', url: '' }, styles: { base: {} } },
        selectors: { root: '&', icon: '.ink-el-icon', media: 'img', title: '.ink-el-box-title', description: '.ink-el-box-desc', link: '.ink-el-box-link' },
        controls: [
            ...(type === 'icon-box' ? [{ tab: 'content', section: 'Content', name: 'icon', type: 'icon', label: 'Icon' }] : [{ tab: 'content', section: 'Content', name: 'image', type: 'media', label: 'Image' }]),
            { tab: 'content', section: 'Content', name: 'title', type: 'text', label: 'Title' },
            { tab: 'content', section: 'Content', name: 'description', type: 'textarea', label: 'Description' },
            { tab: 'content', section: 'Content', name: 'url', type: 'url', label: 'Link' },
            { tab: 'style', target: 'styles', section: 'Icon', name: 'color', type: 'color', label: 'Icon color', part: 'icon' },
            { tab: 'style', target: 'styles', section: 'Icon', name: 'font-size', type: 'size', label: 'Icon size', units: ['px', 'rem'], responsive: true, part: 'icon' },
            { tab: 'style', target: 'styles', section: 'Title', name: 'title-color', type: 'color', label: 'Title color', property: 'color', part: 'title' },
            { tab: 'style', target: 'styles', section: 'Description', name: 'description-color', type: 'color', label: 'Description color', property: 'color', part: 'description' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', `ink-el-${type}`);
            const content = make(domDocument, 'div', 'ink-el-box-copy');
            content.append(make(domDocument, 'h3', 'ink-el-box-title', node.settings.title), make(domDocument, 'p', 'ink-el-box-desc', node.settings.description));
            const targetUrl = url(node.settings.url);
            if (targetUrl) {
                const link = make(domDocument, 'a', 'ink-el-box-link'); link.href = targetUrl;
                if (type === 'icon-box') link.append(icon(domDocument, node.settings.icon, 'ink-el-icon'));
                else { const image = make(domDocument, 'img'); image.src = node.settings.image || ''; image.alt = node.settings.title || ''; link.append(image); }
                link.append(content); root.append(link);
            } else {
                if (type === 'icon-box') root.append(icon(domDocument, node.settings.icon, 'ink-el-icon'));
                else { const image = make(domDocument, 'img'); image.src = node.settings.image || ''; image.alt = node.settings.title || ''; root.append(image); }
                root.append(content);
            }
            return root;
        },
    }));
    register(registry, {
        type: 'icon-list', title: 'Icon List', icon: 'format_list_bulleted',
        defaults: { settings: { items: [{ icon: 'check', text: 'First item', url: '' }, { icon: 'check', text: 'Second item', url: '' }] }, styles: { base: {} } },
        selectors: { root: '&', icon: '.ink-el-icon', text: '.ink-el-icon-list-text', item: 'li' },
        controls: [
            items('items', [textField('text', 'Text'), textField('icon', 'Icon'), textField('url', 'URL')]),
            typographyControls,
            { tab: 'style', target: 'styles', section: 'Icon', name: 'icon-color', type: 'color', label: 'Icon color', property: 'color', part: 'icon' },
            { tab: 'style', target: 'styles', section: 'Icon', name: 'icon-size', type: 'size', label: 'Icon size', units: ['px', 'em', 'rem'], property: 'font-size', part: 'icon' },
            { tab: 'style', target: 'styles', section: 'Text', name: 'text-color', type: 'color', label: 'Text color', property: 'color', part: 'text' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'ul', 'ink-el-icon-list');
            (node.settings.items || []).forEach((item) => {
                const li = make(domDocument, 'li');
                const textEl = make(domDocument, 'span', 'ink-el-icon-list-text', item.text);
                const itemUrl = url(item.url);
                if (itemUrl) { const link = make(domDocument, 'a'); link.href = itemUrl; link.append(icon(domDocument, item.icon), textEl); li.appendChild(link); }
                else li.append(icon(domDocument, item.icon), textEl);
                root.append(li);
            });
            return root;
        },
    });
    register(registry, {
        type: 'counter', title: 'Counter', icon: 'pin',
        defaults: { settings: { number: '100', prefix: '', suffix: '+', title: 'Projects' }, styles: { base: {} } },
        selectors: { root: '&', number: '.ink-el-counter-number', title: '.ink-el-counter-title' },
        controls: [
            { tab: 'content', section: 'Counter', name: 'number', type: 'text', label: 'Number' },
            { tab: 'content', section: 'Counter', name: 'prefix', type: 'text', label: 'Prefix' },
            { tab: 'content', section: 'Counter', name: 'suffix', type: 'text', label: 'Suffix' },
            { tab: 'content', section: 'Counter', name: 'title', type: 'text', label: 'Title' },
            typographyControls,
            { tab: 'style', target: 'styles', section: 'Number', name: 'number-color', type: 'color', label: 'Number color', property: 'color', part: 'number' },
            { tab: 'style', target: 'styles', section: 'Title', name: 'title-color', type: 'color', label: 'Title color', property: 'color', part: 'title' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-counter');
            const number = make(domDocument, 'div', 'ink-el-counter-number');
            const prefix = node.settings.prefix ? make(domDocument, 'span', '', node.settings.prefix) : null;
            const suffix = node.settings.suffix ? make(domDocument, 'span', '', node.settings.suffix) : null;
            if (prefix) number.appendChild(prefix);
            number.appendChild(make(domDocument, 'span', '', node.settings.number || ''));
            if (suffix) number.appendChild(suffix);
            root.append(number, make(domDocument, 'p', 'ink-el-counter-title', node.settings.title));
            return root;
        },
    });
    register(registry, {
        type: 'progress', title: 'Progress Bar', icon: 'linear_scale',
        defaults: { settings: { title: 'Progress', value: 75 }, styles: { base: {} } },
        selectors: { root: '&', track: '.ink-el-progress-track', bar: '.ink-el-progress-value' },
        controls: [
            { tab: 'content', section: 'Progress', name: 'title', type: 'text', label: 'Title' },
            { tab: 'content', section: 'Progress', name: 'value', type: 'slider', label: 'Value', min: 0, max: 100 },
            { tab: 'style', target: 'styles', section: 'Progress', name: 'color', type: 'color', label: 'Bar color', part: 'bar' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-progress');
            const track = make(domDocument, 'div', 'ink-el-progress-track');
            const bar = make(domDocument, 'div', 'ink-el-progress-value');
            bar.style.width = `${node.settings.value || 0}%`;
            bar.append(make(domDocument, 'span', '', node.settings.title), make(domDocument, 'b', '', `${node.settings.value || 0}%`));
            track.appendChild(bar); root.append(track); return root;
        },
    });
    register(registry, {
        type: 'rating', title: 'Rating', icon: 'star_rate',
        defaults: { settings: { rating: 4, scale: 5, label: 'Rating' }, styles: { base: {} } },
        selectors: { root: '&', icon: '.material-symbols-rounded' },
        controls: [
            { tab: 'content', section: 'Rating', name: 'rating', type: 'slider', label: 'Rating', min: 0, max: 5, step: 0.5 },
            { tab: 'content', section: 'Rating', name: 'label', type: 'text', label: 'Accessible label' },
            { tab: 'style', target: 'styles', section: 'Rating', name: 'color', type: 'color', label: 'Star color', part: 'icon' },
            { tab: 'style', target: 'styles', section: 'Rating', name: 'icon-size', type: 'size', label: 'Star size', units: ['px', 'em', 'rem'], property: 'font-size', part: 'icon' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-rating');
            root.setAttribute('role', 'img'); root.setAttribute('aria-label', `${node.settings.label}: ${node.settings.rating} out of ${node.settings.scale || 5}`);
            for (let i = 1; i <= (node.settings.scale || 5); i += 1) {
                const star = icon(domDocument, i <= Math.round(node.settings.rating) ? 'star' : 'star_outline');
                star.classList.toggle('is-rated', i <= Math.round(node.settings.rating));
                star.setAttribute('aria-hidden', 'true');
                root.appendChild(star);
            }
            return root;
        },
    });
    register(registry, {
        type: 'testimonial', title: 'Testimonial', icon: 'format_quote',
        defaults: { settings: { quote: 'It just works, and our team loves it.', name: 'Alex Morgan', role: 'Founder', avatar: '' }, styles: { base: {} } },
        selectors: { root: '&', quote: 'blockquote', name: '.ink-el-testimonial-name', role: '.ink-el-testimonial-role', avatar: '.ink-el-avatar' },
        controls: [
            { tab: 'content', section: 'Testimonial', name: 'quote', type: 'textarea', label: 'Quote' },
            { tab: 'content', section: 'Testimonial', name: 'name', type: 'text', label: 'Name' },
            { tab: 'content', section: 'Testimonial', name: 'role', type: 'text', label: 'Role' },
            { tab: 'content', section: 'Testimonial', name: 'avatar', type: 'media', label: 'Avatar' },
            typographyControls,
            { tab: 'style', target: 'styles', section: 'Text', name: 'quote-color', type: 'color', label: 'Quote color', property: 'color', part: 'quote' },
            { tab: 'style', target: 'styles', section: 'Text', name: 'name-color', type: 'color', label: 'Name color', property: 'color', part: 'name' },
            { tab: 'style', target: 'styles', section: 'Text', name: 'role-color', type: 'color', label: 'Role color', property: 'color', part: 'role' },
            { tab: 'style', target: 'styles', section: 'Media', name: 'avatar-radius', type: 'size', label: 'Avatar radius', units: ['px', '%'], property: 'border-radius', part: 'avatar' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'figure', 'ink-el-testimonial');
            root.append(make(domDocument, 'blockquote', '', node.settings.quote));
            const caption = make(domDocument, 'figcaption');
            const avatar = make(domDocument, 'img', 'ink-el-avatar'); avatar.src = node.settings.avatar || ''; avatar.alt = node.settings.name || '';
            const copy = make(domDocument, 'div');
            copy.append(make(domDocument, 'div', 'ink-el-testimonial-name', node.settings.name), make(domDocument, 'div', 'ink-el-testimonial-role', node.settings.role));
            caption.append(avatar, copy); root.append(caption); return root;
        },
    });
    register(registry, {
        type: 'tabs', title: 'Tabs', icon: 'tab',
        defaults: { settings: { items: [{ title: 'Tab 1', content: 'First tab content.' }, { title: 'Tab 2', content: 'Second tab content.' }] }, styles: { base: {} } },
        selectors: { root: '&', title: '.ink-el-tabs-nav button', panel: '.ink-el-tab-panel' },
        controls: [
            items('items', [textField('title', 'Title'), textField('content', 'Content', 'textarea')]),
            { tab: 'style', target: 'styles', section: 'Title', name: 'title-color', type: 'color', label: 'Title color', property: 'color', part: 'title' },
            { tab: 'style', target: 'styles', section: 'Panel', name: 'panel-color', type: 'color', label: 'Content color', property: 'color', part: 'panel' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-tabs');
            const nav = make(domDocument, 'div', 'ink-el-tabs-nav'); nav.setAttribute('role', 'tablist');
            const items = node.settings.items || [];
            items.forEach((item, index) => {
                const button = make(domDocument, 'button', '', item.title); button.type = 'button';
                button.id = `ink-tab-${node.id}-${index}`; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(index === 0)); button.setAttribute('aria-controls', `ink-panel-${node.id}-${index}`); button.tabIndex = index === 0 ? 0 : -1;
                if (index === 0) button.classList.add('is-active');
                nav.appendChild(button);
            });
            root.append(nav);
            items.forEach((item, index) => {
                const panel = make(domDocument, 'div', 'ink-el-tab-panel', item.content);
                panel.id = `ink-panel-${node.id}-${index}`; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', `ink-tab-${node.id}-${index}`); panel.hidden = index !== 0;
                root.append(panel);
            });
            return root;
        },
    });
    ['accordion', 'toggle'].forEach((type) => register(registry, {
        type,
        title: type === 'accordion' ? 'Accordion' : 'Toggle',
        icon: type === 'accordion' ? 'vertical_align_center' : 'toggle_on',
        defaults: { settings: { items: [{ title: 'Can I customize it?', content: 'Everything is configurable.' }, { title: 'Is it responsive?', content: 'Yes, each layout control supports device overrides.' }] }, styles: { base: {} } },
        selectors: { root: '&', title: 'summary', content: 'details > div' },
        controls: [
            items('items', [textField('title', 'Title'), textField('content', 'Content', 'textarea')]),
            { tab: 'style', target: 'styles', section: 'Title', name: 'title-color', type: 'color', label: 'Title color', property: 'color', part: 'title' },
            { tab: 'style', target: 'styles', section: 'Content', name: 'content-color', type: 'color', label: 'Content color', property: 'color', part: 'content' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-accordion');
            (node.settings.items || []).forEach((item, index) => {
                const detail = make(domDocument, 'details'); detail.open = type === 'accordion' && index === 0;
                detail.append(make(domDocument, 'summary', '', item.title), make(domDocument, 'div', '', item.content));
                root.append(detail);
            });
            return root;
        },
    }));
    register(registry, {
        type: 'timeline-accordion', title: 'Timeline Accordion', icon: 'account_tree', category: 'Interactive', acceptsChildren: true,
        defaults: {
            settings: {
                behavior: 'single', defaultOpen: 0, transitionDuration: 280,
                items: [
                    { eyebrow: 'MID 2023', title: 'The Spark of an Idea', content: 'Tell the story behind this milestone.' },
                    { eyebrow: 'LATE 2024', title: 'Research and Product Prototype', content: 'Explain what changed at this stage.' },
                    { eyebrow: 'EARLY 2025', title: 'Design and Development', content: 'Share the outcome and the next step.' },
                ],
            },
            styles: { base: {} },
        },
        selectors: {
            root: '&', item: '.ink-el-timeline-item', question: '.ink-el-timeline-question',
            eyebrow: '.ink-el-timeline-eyebrow', title: '.ink-el-timeline-title', content: '.ink-el-timeline-content',
        },
        controls: [
            { ...items('items', [textField('eyebrow', 'Date / eyebrow'), textField('title', 'Title'), textField('content', 'Content', 'textarea')]), condition: { not: { importedDom: true } } },
            { tab: 'content', section: 'Interaction', name: 'behavior', type: 'choose', label: 'Open items', options: [{ value: 'single', label: 'One' }, { value: 'multiple', label: 'Multiple' }] },
            { tab: 'content', section: 'Interaction', name: 'defaultOpen', type: 'number', label: 'Initially open item', description: 'Zero-based item position. Use -1 for all closed.' },
            { tab: 'content', section: 'Interaction', name: 'transitionDuration', type: 'number', label: 'Transition (ms)' },
            { tab: 'style', target: 'styles', section: 'Item', name: 'item-background', type: 'color', label: 'Background', property: 'background-color', part: 'item' },
            { tab: 'style', target: 'styles', section: 'Item', name: 'item-radius', type: 'size', label: 'Radius', units: ['px', 'rem'], property: 'border-radius', part: 'item' },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'eyebrow-color', type: 'color', label: 'Date color', property: 'color', part: 'eyebrow' },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'title-color', type: 'color', label: 'Title color', property: 'color', part: 'title' },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'content-color', type: 'color', label: 'Content color', property: 'color', part: 'content' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-timeline-accordion');
            (node.settings.items || []).forEach((item) => {
                const article = make(domDocument, 'article', 'ink-el-timeline-item');
                const question = make(domDocument, 'button', 'ink-el-timeline-question'); question.type = 'button';
                const copy = make(domDocument, 'span', 'ink-el-timeline-copy');
                copy.append(make(domDocument, 'span', 'ink-el-timeline-eyebrow', item.eyebrow), make(domDocument, 'strong', 'ink-el-timeline-title', item.title));
                const glyph = make(domDocument, 'span', 'ink-el-timeline-glyph', '+'); glyph.setAttribute('aria-hidden', 'true');
                question.append(copy, glyph);
                const content = make(domDocument, 'div', 'ink-el-timeline-content', item.content);
                article.append(question, content); root.appendChild(article);
            });
            return root;
        },
        mount: ({ element, node }) => {
            const imported = !!node.settings.importedDom;
            const items = imported
                ? Array.from(element.querySelectorAll('[data-framer-name="Close"], [data-framer-name="Open"]'))
                : Array.from(element.querySelectorAll(':scope > .ink-el-timeline-item'));
            const questionFor = (item) => imported ? item.querySelector('[data-framer-name="Question Wrapper"]') : item.querySelector('.ink-el-timeline-question');
            const contentFor = (item) => imported ? item.querySelector('[data-framer-name="Details Wrapper"]') : item.querySelector('.ink-el-timeline-content');
            const setOpen = (item, open) => {
                const question = questionFor(item); const content = contentFor(item);
                item.classList.toggle('is-open', open); item.dataset.inkTimelineItem = '';
                if (question) { question.dataset.inkTimelineQuestion = ''; question.setAttribute('role', 'button'); question.setAttribute('aria-expanded', String(open)); question.tabIndex = 0; }
                if (content) { content.dataset.inkTimelineContent = ''; content.setAttribute('aria-hidden', String(!open)); }
            };
            const defaultOpen = Number(node.settings.defaultOpen ?? 0);
            items.forEach((item, index) => setOpen(item, index === defaultOpen));
            element.style.setProperty('--ink-timeline-duration', `${Math.max(0, Number(node.settings.transitionDuration) || 280)}ms`);
            element.dataset.inkTimelineBehavior = node.settings.behavior || 'single';
            const activate = (item) => {
                const opening = !item.classList.contains('is-open');
                if (opening && node.settings.behavior !== 'multiple') items.forEach((candidate) => { if (candidate !== item) setOpen(candidate, false); });
                setOpen(item, opening);
            };
            const click = (event) => { const question = event.target.closest('[data-ink-timeline-question]'); if (question && element.contains(question)) { event.preventDefault(); activate(question.closest('[data-ink-timeline-item]')); } };
            const keydown = (event) => { const question = event.target.closest('[data-ink-timeline-question]'); if (question && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); activate(question.closest('[data-ink-timeline-item]')); } };
            // Capture before nested builder nodes stop bubbling to select themselves.
            element.addEventListener('click', click, true); element.addEventListener('keydown', keydown, true);
            element.__inkTimelineCleanup = () => { element.removeEventListener('click', click, true); element.removeEventListener('keydown', keydown, true); };
        },
        unmount: ({ element }) => element.__inkTimelineCleanup?.(),
    });
    register(registry, {
        type: 'alert', title: 'Alert', icon: 'info',
        defaults: { settings: { title: 'Notice', message: 'This is an important message.', type: 'info' }, styles: { base: {} } },
        selectors: { root: '&', icon: '> .material-symbols-rounded', title: 'strong', message: 'span' },
        controls: [
            { tab: 'content', section: 'Alert', name: 'title', type: 'text', label: 'Title' },
            { tab: 'content', section: 'Alert', name: 'message', type: 'textarea', label: 'Message' },
            { tab: 'content', section: 'Alert', name: 'type', type: 'select', label: 'Type', options: ['info', 'success', 'warning', 'danger'] },
            { tab: 'style', target: 'styles', section: 'Text', name: 'title-color', type: 'color', label: 'Title color', property: 'color', part: 'title' },
            { tab: 'style', target: 'styles', section: 'Text', name: 'message-color', type: 'color', label: 'Message color', property: 'color', part: 'message' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const colors = { info: '#6ec1e4', success: '#61ce70', warning: '#f0ad4e', danger: '#ec7063' };
            const root = make(domDocument, 'div', 'ink-el-alert');
            root.style.setProperty('--alert-color', colors[node.settings.type] || colors.info);
            root.append(icon(domDocument, node.settings.type === 'success' ? 'check_circle' : node.settings.type === 'warning' ? 'warning' : node.settings.type === 'danger' ? 'error' : 'info'));
            const copy = make(domDocument, 'div'); copy.append(make(domDocument, 'strong', '', node.settings.title), make(domDocument, 'span', '', node.settings.message));
            root.append(copy); return root;
        },
    });
    register(registry, {
        type: 'audio', title: 'Audio', icon: 'audio_file',
        defaults: { settings: { src: '', controls: true }, styles: { base: { width: '100%' } } },
        controls: [{ tab: 'content', section: 'Audio', name: 'src', type: 'media', label: 'Audio file' }, ...spacing],
        render: ({ domDocument }, node) => { const root = make(domDocument, 'audio', 'ink-el-audio'); root.src = node.settings.src || ''; root.controls = true; return root; },
    });
    register(registry, {
        type: 'video', title: 'Video', icon: 'smart_display',
        defaults: { settings: { src: '', poster: '', controls: true }, styles: { base: { width: '100%' } } },
        controls: [
            { tab: 'content', section: 'Video', name: 'src', type: 'media', label: 'Video file' },
            { tab: 'content', section: 'Video', name: 'poster', type: 'media', label: 'Poster' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => { const root = make(domDocument, 'video', 'ink-el-video'); root.src = node.settings.src || ''; root.poster = node.settings.poster || ''; root.controls = true; return root; },
    });
    register(registry, {
        type: 'map', title: 'Google Maps', icon: 'map',
        defaults: { settings: { query: 'Lagos, Nigeria', zoom: 12 }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Map', name: 'query', type: 'text', label: 'Location' },
            { tab: 'content', section: 'Map', name: 'zoom', type: 'slider', label: 'Zoom', min: 1, max: 20 },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'iframe', 'ink-el-map'); root.loading = 'lazy'; root.referrerPolicy = 'no-referrer-when-downgrade'; root.title = node.settings.query || 'Google Maps';
            root.src = `https://maps.google.com/maps?q=${encodeURIComponent(node.settings.query || '')}&z=${node.settings.zoom || 12}&output=embed`;
            return root;
        },
    });
    const galleryDefaults = { settings: { images: [], lightbox: true }, styles: { base: {} } };
    const galleryControls = [
        { tab: 'content', section: 'Images', name: 'images', type: 'gallery', label: 'Gallery' },
        { tab: 'content', section: 'Lightbox', name: 'lightbox', type: 'switcher', label: 'Open images in a lightbox' },
        ...spacing,
    ];
    register(registry, {
        type: 'gallery', title: 'Image Gallery', icon: 'collections', defaults: galleryDefaults, controls: galleryControls,
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-gallery');
            root.dataset.lightbox = node.settings.lightbox === false ? 'false' : 'true';
            (node.settings.images || []).forEach((item) => { const image = make(domDocument, 'img'); image.src = typeof item === 'string' ? item : item.url; image.alt = item.alt || ''; image.loading = 'lazy'; root.append(image); });
            return root;
        },
    });
    register(registry, {
        type: 'carousel', title: 'Image Carousel', icon: 'view_carousel',
        defaults: { settings: { images: [], navigation: 'arrows', autoplay: false, interval: 4000, loop: false }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Images', name: 'images', type: 'gallery', label: 'Gallery' },
            { tab: 'content', section: 'Carousel', name: 'navigation', type: 'select', label: 'Navigation', options: ['arrows', 'dots', 'both', 'none'] },
            { tab: 'content', section: 'Carousel', name: 'loop', type: 'switcher', label: 'Loop' },
            { tab: 'content', section: 'Carousel', name: 'autoplay', type: 'switcher', label: 'Autoplay' },
            { tab: 'content', section: 'Carousel', name: 'interval', type: 'slider', label: 'Autoplay interval', min: 1000, max: 12000, step: 500 },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-carousel');
            root.dataset.autoplay = node.settings.autoplay ? 'true' : 'false';
            root.dataset.loop = node.settings.loop ? 'true' : 'false';
            root.dataset.interval = String(node.settings.interval || 4000);
            const track = make(domDocument, 'div', 'ink-el-carousel-track');
            (node.settings.images || []).forEach((item) => {
                const slide = make(domDocument, 'div', 'ink-el-carousel-slide');
                const image = make(domDocument, 'img'); image.src = typeof item === 'string' ? item : item.url; image.alt = item.alt || ''; image.loading = 'lazy'; image.draggable = false;
                slide.appendChild(image); track.appendChild(slide);
            });
            root.appendChild(track);
            const navigation = node.settings.navigation || 'arrows';
            if (navigation === 'arrows' || navigation === 'both') {
                const prev = make(domDocument, 'button', 'ink-el-carousel-nav is-prev'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous slide'); prev.appendChild(renderIcon(domDocument, 'chevron_left', 'ink-carousel-icon'));
                const next = make(domDocument, 'button', 'ink-el-carousel-nav is-next'); next.type = 'button'; next.setAttribute('aria-label', 'Next slide'); next.appendChild(renderIcon(domDocument, 'chevron_right', 'ink-carousel-icon'));
                root.append(prev, next);
            }
            if (navigation === 'dots' || navigation === 'both') {
                const dots = make(domDocument, 'div', 'ink-el-carousel-dots');
                (node.settings.images || []).forEach((item, index) => {
                    const dot = make(domDocument, 'button', index === 0 ? 'ink-el-carousel-dot is-active' : 'ink-el-carousel-dot'); dot.type = 'button'; dot.dataset.carouselDot = ''; dot.dataset.index = String(index); dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
                    dots.appendChild(dot);
                });
                root.appendChild(dots);
            }
            return root;
        },
    });
    register(registry, {
        type: 'social-icons', title: 'Social Icons', icon: 'share',
        defaults: { settings: { items: [{ icon: 'public', label: 'Website', url: '' }, { icon: 'alternate_email', label: 'Email', url: '' }] }, styles: { base: {} } },
        controls: [items('items', [textField('label', 'Label'), textField('icon', 'Icon'), textField('url', 'URL')]), ...spacing],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-social');
            (node.settings.items || []).forEach((item) => { const link = make(domDocument, 'a'); link.href = url(item.url) || '#'; link.title = item.label || ''; link.setAttribute('aria-label', item.label || 'Social link'); link.append(icon(domDocument, item.icon)); root.append(link); });
            return root;
        },
    });
    register(registry, {
        type: 'anchor', title: 'Menu Anchor', icon: 'anchor',
        defaults: { settings: { id: 'section-anchor', offset: 0 }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Anchor', name: 'id', type: 'text', label: 'Anchor ID' },
            { tab: 'content', section: 'Anchor', name: 'offset', type: 'number', label: 'Offset' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => { const root = make(domDocument, 'span', 'ink-el-anchor'); root.id = node.settings.id || ''; root.style.setProperty('--anchor-offset', `${node.settings.offset || 0}px`); return root; },
    });
    register(registry, {
        type: 'read-more', title: 'Read More', icon: 'read_more',
        defaults: { settings: { text: 'Read more', url: '' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Link', name: 'text', type: 'text', label: 'Text' },
            { tab: 'content', section: 'Link', name: 'url', type: 'url', label: 'URL' },
            typographyControls, ...spacing,
        ],
        render: ({ domDocument }, node) => { const root = make(domDocument, 'a', 'ink-el-read-more', node.settings.text); root.href = url(node.settings.url) || '#'; root.append(icon(domDocument, 'arrow_forward')); return root; },
    });
    register(registry, {
        type: 'plugin-widget', title: 'Plugin Widget', icon: 'extension', category: 'Ink Extensions',
        defaults: { settings: { provider: '', widget: '', payload: '{}' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Extension', name: 'provider', type: 'text', label: 'Provider' },
            { tab: 'content', section: 'Extension', name: 'widget', type: 'text', label: 'Widget' },
            { tab: 'content', section: 'Extension', name: 'payload', type: 'code', label: 'JSON payload' },
            ...spacing,
        ],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'div', 'ink-el-plugin', node.settings.provider && node.settings.widget ? `${node.settings.provider} / ${node.settings.widget}` : 'Choose an installed Ink extension widget');
            root.dataset.inkPluginProvider = node.settings.provider || ''; root.dataset.inkPluginWidget = node.settings.widget || '';
            return root;
        },
    });
    return registry;
}
