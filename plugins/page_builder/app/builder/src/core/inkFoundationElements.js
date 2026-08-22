const text = (domDocument, tag, className, value) => {
    const element = domDocument.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
};

// Ink-style shell: boxed (inner content limited to the site content width) or full-width.
// The inner wrapper is the drop target for child elements.
function renderShell(domDocument, node, rootClass, tag = 'div') {
    const root = domDocument.createElement(node.settings.tag || tag);
    root.className = rootClass;
    const layout = node.settings.layout || 'boxed';
    root.classList.add(`is-${layout}`);
    const inner = domDocument.createElement('div'); inner.className = `${rootClass}-inner`; inner.dataset.inkChildren = '';
    root.appendChild(inner);
    return root;
}

const layoutControls = [
    { tab: 'content', target: 'styles', section: 'Layout', name: 'display', type: 'choose', label: 'Display', options: ['flex', 'grid', 'block'], responsive: true },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'flex-direction', type: 'choose', label: 'Direction', options: ['row', 'column'], responsive: true, condition: { display: 'flex' } },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'flex-wrap', type: 'choose', label: 'Wrap', options: ['nowrap', 'wrap', 'wrap-reverse'], responsive: true, condition: { display: 'flex' } },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'justify-content', type: 'choose', label: 'Justify content', options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'], responsive: true },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'align-items', type: 'choose', label: 'Align items', options: ['stretch', 'flex-start', 'center', 'flex-end'], responsive: true },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'align-content', type: 'select', label: 'Align content', options: ['normal', 'stretch', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around'], responsive: true },
    { tab: 'content', target: 'styles', section: 'Layout', name: 'gap', type: 'gaps', label: 'Row / column gap', units: ['px', 'rem', '%', 'vw'], responsive: true },
    { tab: 'content', target: 'styles', section: 'Grid', name: 'grid-template-columns', type: 'text', label: 'Columns', responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Grid', name: 'grid-template-rows', type: 'text', label: 'Rows', responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Grid', name: 'grid-auto-flow', type: 'select', label: 'Auto flow', options: ['row', 'column', 'dense', 'row dense', 'column dense'], responsive: true, condition: { display: 'grid' } },
];

// Modern container controls. Child layout styles target the inner wrapper because it
// is the direct parent of the elements placed inside a boxed or full-width container.
const containerLayoutControls = [
    { tab: 'content', target: 'styles', section: 'Container', name: 'display', type: 'select', label: 'Container Layout', options: [{ value: 'flex', label: 'Flexbox' }, { value: 'grid', label: 'Grid' }] },
    { tab: 'content', section: 'Container', name: 'layout', type: 'select', label: 'Content Width', options: [{ value: 'boxed', label: 'Boxed' }, { value: 'full', label: 'Full Width' }] },
    { tab: 'content', target: 'styles', section: 'Container', name: 'boxed-width', type: 'slider', label: 'Width', min: 500, max: 1600, default: 1140, units: ['px', '%', 'em', 'rem', 'vw'], responsive: true, condition: { layout: 'boxed' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'width', type: 'slider', label: 'Width', min: 0, max: 100, default: 100, units: ['%', 'px', 'em', 'rem', 'vw'], responsive: true, condition: { layout: 'full' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'min-height', type: 'slider', label: 'Min Height', min: 0, max: 1440, default: 0, units: ['px', 'em', 'rem', 'vh'], responsive: true, description: 'To achieve full height Container use 100vh.' },
    { tab: 'content', section: 'Container', name: '__items', type: 'heading', label: 'Items', text: 'Items', condition: { display: 'flex' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'flex-direction', type: 'choose', label: 'Direction', options: [{ value: 'row', label: 'Row — horizontal', icon: 'arrow_forward' }, { value: 'column', label: 'Column — vertical', icon: 'arrow_downward' }, { value: 'row-reverse', label: 'Row — reversed', icon: 'arrow_back' }, { value: 'column-reverse', label: 'Column — reversed', icon: 'arrow_upward' }], responsive: true, condition: { display: 'flex' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'justify-content', type: 'choose', label: 'Justify Content', options: [{ value: 'flex-start', label: 'Start', icon: 'align_horizontal_left' }, { value: 'center', label: 'Center', icon: 'align_horizontal_center' }, { value: 'flex-end', label: 'End', icon: 'align_horizontal_right' }, { value: 'space-between', label: 'Space Between', icon: 'space_bar' }, { value: 'space-around', label: 'Space Around', icon: 'density_medium' }, { value: 'space-evenly', label: 'Space Evenly', icon: 'drag_handle' }], responsive: true, condition: { display: 'flex' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'align-items', type: 'choose', label: 'Align Items', options: [{ value: 'flex-start', label: 'Start', icon: 'vertical_align_top' }, { value: 'center', label: 'Center', icon: 'vertical_align_center' }, { value: 'flex-end', label: 'End', icon: 'vertical_align_bottom' }, { value: 'stretch', label: 'Stretch', icon: 'height' }], responsive: true, condition: { display: 'flex' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'gap', type: 'gaps', label: 'Gaps', units: ['px', '%', 'em', 'rem', 'vw'], responsive: true },
    { tab: 'content', target: 'styles', section: 'Container', name: 'flex-wrap', type: 'choose', label: 'Wrap', options: [{ value: 'nowrap', label: 'No Wrap', icon: 'east' }, { value: 'wrap', label: 'Wrap', icon: 'keyboard_return' }], responsive: true, condition: { display: 'flex' }, description: 'Items can stay in a single line or wrap onto multiple lines.' },
    { tab: 'content', target: 'styles', section: 'Container', name: 'align-content', type: 'choose', label: 'Align Content', options: [{ value: 'flex-start', label: 'Start', icon: 'vertical_align_top' }, { value: 'center', label: 'Middle', icon: 'vertical_align_center' }, { value: 'flex-end', label: 'End', icon: 'vertical_align_bottom' }, { value: 'space-between', label: 'Space Between', icon: 'height' }], responsive: true, condition: { display: 'flex', 'flex-wrap': 'wrap' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'grid-template-columns', type: 'text', label: 'Columns', responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'grid-template-rows', type: 'text', label: 'Rows', responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'grid-auto-flow', type: 'select', label: 'Auto Flow', options: ['row', 'column'], responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Container', name: 'justify-items', type: 'choose', label: 'Justify Items', options: [{ value: 'start', label: 'Start', icon: 'align_horizontal_left' }, { value: 'center', label: 'Center', icon: 'align_horizontal_center' }, { value: 'end', label: 'End', icon: 'align_horizontal_right' }, { value: 'stretch', label: 'Stretch', icon: 'width' }], responsive: true, condition: { display: 'grid' } },
    { tab: 'content', target: 'styles', section: 'Additional Options', name: 'overflow', type: 'select', label: 'Overflow', options: [{ value: '', label: 'Default' }, { value: 'hidden', label: 'Hidden' }, { value: 'auto', label: 'Auto' }] },
    { tab: 'content', section: 'Additional Options', name: 'tag', type: 'select', label: 'HTML Tag', options: ['div', 'header', 'footer', 'main', 'article', 'section', 'aside', 'nav'] },
];

const advancedControls = [
    { tab: 'advanced', target: 'styles', section: 'Spacing', name: 'margin', type: 'dimensions', label: 'Margin', units: ['px', 'rem', '%'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Spacing', name: 'padding', type: 'dimensions', label: 'Padding', units: ['px', 'rem', '%'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'width', type: 'size', label: 'Width', units: ['px', '%', 'vw'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'max-width', type: 'size', label: 'Maximum width', units: ['px', '%', 'vw', 'rem'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'height', type: 'size', label: 'Height', units: ['px', '%', 'vh'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'min-height', type: 'size', label: 'Minimum height', units: ['px', 'vh'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'overflow', type: 'select', label: 'Overflow', options: ['visible', 'hidden', 'auto', 'scroll', 'clip'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Positioning', name: 'position', type: 'select', label: 'Position', options: ['static', 'relative', 'absolute', 'fixed', 'sticky'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Positioning', name: 'z-index', type: 'number', label: 'Z-index', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Flex item', name: 'align-self', type: 'select', label: 'Align self', options: ['auto', 'stretch', 'flex-start', 'center', 'flex-end'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Flex item', name: 'order', type: 'number', label: 'Order', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Flex item', name: 'flex-grow', type: 'number', label: 'Grow', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Flex item', name: 'flex-shrink', type: 'number', label: 'Shrink', responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Effects', name: 'opacity', type: 'slider', label: 'Opacity', min: 0, max: 1, step: 0.05, responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Effects', name: 'filter', type: 'css-filters', label: 'CSS filters' },
];

const surfaceControls = [
    { tab: 'style', target: 'styles', section: 'Background', name: 'background', type: 'background', label: 'Background' },
    { tab: 'style', target: 'styles', section: 'Border', name: 'border', type: 'border', label: 'Border' },
    { tab: 'style', target: 'styles', section: 'Border', name: 'border-radius', type: 'dimensions', label: 'Radius', units: ['px', 'rem', '%'], responsive: true },
    { tab: 'style', target: 'styles', section: 'Effects', name: 'box-shadow', type: 'box-shadow', label: 'Box shadow' },
];

// Single typography popover (Ink) writing to the element's style bucket.
const typographyControls = {
    tab: 'style', target: 'styles', section: 'Typography', name: 'typography', type: 'typography', label: 'Typography',
};

export default function registerInkFoundationElements(registry) {
    registry.register({
        type: 'container', title: 'Container', icon: 'view_column', category: 'Layout', acceptsChildren: true,
        defaults: { settings: { tag: 'div', layout: 'boxed' }, styles: { base: { display: 'flex', 'flex-direction': 'column', width: '100%', padding: { top: 10, right: 10, bottom: 10, left: 10, unit: 'px' }, gap: { row: 20, column: 20, unit: 'px' } } }, children: [] },
        tabLabels: { content: 'Layout' },
        tabIcons: { content: 'view_column' },
        selectors: { root: '&', inner: '.ink-el-container-inner' },
        styleMap: {
            display: { part: 'inner' },
            'flex-direction': { part: 'inner' },
            'flex-wrap': { part: 'inner' },
            'justify-content': { part: 'inner' },
            'align-items': { part: 'inner' },
            'align-content': { part: 'inner' },
            gap: { part: 'inner' },
            'grid-template-columns': { part: 'inner' },
            'grid-template-rows': { part: 'inner' },
            'grid-auto-flow': { part: 'inner' },
            'justify-items': { part: 'inner' },
            'boxed-width': { part: 'inner', property: 'max-width' },
        },
        controls: [
            ...containerLayoutControls,
            ...surfaceControls,
            ...advancedControls.filter((control) => !['width', 'min-height', 'overflow'].includes(control.name)),
        ],
        render: ({ domDocument }, node) => renderShell(domDocument, node, 'ink-el-container', 'div'),
    });
    registry.register({
        type: 'div', title: 'Div Block', icon: 'check_box_outline_blank', category: 'Layout', acceptsChildren: true,
        defaults: { settings: {}, styles: { base: { display: 'block' } }, children: [] }, controls: [...layoutControls, ...surfaceControls, ...advancedControls],
        render: ({ domDocument }) => { const el = domDocument.createElement('div'); el.dataset.inkChildren = ''; return el; },
    });
    registry.register({
        type: 'heading', title: 'Heading', icon: 'title', category: 'Basic', inlineEditable: 'text',
        defaults: { settings: { text: 'Heading', tag: 'h2', size: '', link: '' }, styles: { base: {} } },
        selectors: { root: '&', link: '.ink-el-heading-link' },
        controls: [
            { tab: 'content', section: 'Content', name: 'text', type: 'text', label: 'Title' },
            { tab: 'content', section: 'Content', name: 'tag', type: 'select', label: 'HTML tag', options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p'] },
            { tab: 'content', section: 'Content', name: 'size', type: 'choose', label: 'Size', options: [{ value: '', label: 'Default' }, { value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }, { value: 'xl', label: 'XL' }, { value: 'xxl', label: 'XXL' }] },
            { tab: 'content', section: 'Content', name: 'link', type: 'url', label: 'Link' },
            typographyControls,
            { tab: 'style', target: 'styles', section: 'Typography', name: 'color', type: 'color', label: 'Color', states: true },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'text-align', type: 'choose', label: 'Alignment', options: [{ value: 'left', icon: 'format_align_left' }, { value: 'center', icon: 'format_align_center' }, { value: 'right', icon: 'format_align_right' }, { value: 'justify', icon: 'format_align_justify' }], responsive: true },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'text-shadow', type: 'text-shadow', label: 'Text shadow' },
            { tab: 'style', target: 'styles', section: 'Typography', name: '-webkit-text-stroke', type: 'text-stroke', label: 'Text stroke' },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'mix-blend-mode', type: 'select', label: 'Blend mode', options: ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion'] },
            { tab: 'style', target: 'styles', section: 'Link', name: 'link-color', type: 'color', label: 'Link color', states: true, property: 'color', part: 'link' },
            ...advancedControls,
            { tab: 'advanced', section: 'Custom attributes', name: 'cssId', type: 'text', label: 'CSS ID' },
            { tab: 'advanced', section: 'Custom attributes', name: 'cssClasses', type: 'text', label: 'CSS classes' },
        ],
        render: ({ domDocument }, node) => {
            const element = text(domDocument, node.settings.tag || 'h2', 'ink-el-heading', node.settings.text || '');
            if (node.settings.size) element.classList.add(`ink-size-${node.settings.size}`);
            if (node.settings.cssId) element.id = node.settings.cssId;
            if (node.settings.cssClasses) element.classList.add(...String(node.settings.cssClasses).trim().split(/\s+/));
            const link = node.settings.link && typeof node.settings.link === 'object' ? node.settings.link : node.settings.link ? { url: node.settings.link } : null;
            if (link && link.url) {
                const anchor = domDocument.createElement('a'); anchor.href = link.url; anchor.className = 'ink-el-heading-link';
                if (link.target) anchor.target = link.target;
                if (link.nofollow) anchor.setAttribute('rel', 'nofollow');
                anchor.textContent = node.settings.text || '';
                element.textContent = '';
                element.appendChild(anchor);
            }
            return element;
        },
    });
    registry.register({
        type: 'paragraph', title: 'Paragraph', icon: 'subject', category: 'Basic', inlineEditable: 'text',
        defaults: { settings: { text: 'Add your text here.' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Content', name: 'text', type: 'textarea', label: 'Text' },
            typographyControls,
            { tab: 'style', target: 'styles', section: 'Typography', name: 'color', type: 'color', label: 'Color' },
            { tab: 'style', target: 'styles', section: 'Typography', name: 'text-align', type: 'choose', label: 'Alignment', options: [{ value: 'left', icon: 'format_align_left' }, { value: 'center', icon: 'format_align_center' }, { value: 'right', icon: 'format_align_right' }, { value: 'justify', icon: 'format_align_justify' }], responsive: true },
            ...advancedControls,
        ],
        render: ({ domDocument }, node) => text(domDocument, 'p', 'ink-el-paragraph', node.settings.text || ''),
    });
    registry.register({
        type: 'button', title: 'Button', icon: 'smart_button', category: 'Basic',
        defaults: { settings: { text: 'Click here', url: '#', target: '_self', size: 'sm', icon: '', iconPosition: 'before', align: '' }, styles: { base: {} } },
        selectors: { root: '&', text: '.ink-el-button-text', icon: '.ink-el-button-icon' },
        styleMap: { 'icon-gap': { property: '--ink-icon-gap', transform: (value) => `${Number(value.size) || 0}${value.unit || 'px'}` } },
        controls: [
            { tab: 'content', section: 'Content', name: 'text', type: 'text', label: 'Text' },
            { tab: 'content', section: 'Content', name: 'url', type: 'url', label: 'Link' },
            { tab: 'content', section: 'Content', name: 'target', type: 'select', label: 'Target', options: [{ value: '_self', label: 'Same window' }, { value: '_blank', label: 'New window' }] },
            { tab: 'content', section: 'Layout', name: 'size', type: 'choose', label: 'Size', options: [{ value: 'xs', label: 'XS' }, { value: 'sm', label: 'SM' }, { value: 'md', label: 'MD' }, { value: 'lg', label: 'LG' }, { value: 'xl', label: 'XL' }] },
            { tab: 'content', section: 'Layout', name: 'icon', type: 'text', label: 'Icon' },
            { tab: 'content', section: 'Layout', name: 'iconPosition', type: 'choose', label: 'Icon position', options: [{ value: 'before', label: 'Before' }, { value: 'after', label: 'After' }], condition: { icon: '__not_empty__' } },
            { tab: 'content', section: 'Layout', name: 'align', type: 'choose', label: 'Alignment', options: [{ value: '', icon: 'format_align_left', label: 'Left' }, { value: 'center', icon: 'format_align_center', label: 'Center' }, { value: 'right', icon: 'format_align_right', label: 'Right' }] },
            { tab: 'style', target: 'styles', section: 'Button', name: 'color', type: 'color', label: 'Text color', states: true, part: 'text' },
            { tab: 'style', target: 'styles', section: 'Button', name: 'background-color', type: 'color', label: 'Background', states: true },
            { tab: 'style', target: 'styles', section: 'Button', name: 'border-radius', type: 'size', label: 'Border radius', units: ['px', 'rem'] },
            { tab: 'style', target: 'styles', section: 'Button', name: 'padding', type: 'dimensions', label: 'Inner padding', units: ['px', 'em', 'rem'], responsive: true },
            { tab: 'style', target: 'styles', section: 'Button', name: 'border', type: 'border', label: 'Border', states: true },
            { tab: 'style', target: 'styles', section: 'Button', name: 'box-shadow', type: 'box-shadow', label: 'Box shadow', states: true },
            { tab: 'style', target: 'styles', section: 'Icon', name: 'icon-size', type: 'size', label: 'Icon size', units: ['px', 'em', 'rem'], property: 'font-size', part: 'icon' },
            { tab: 'style', target: 'styles', section: 'Icon', name: 'icon-gap', type: 'size', label: 'Icon spacing', units: ['px', 'em', 'rem'] },
            { ...typographyControls, part: 'text' },
            ...advancedControls,
            { tab: 'advanced', section: 'Custom attributes', name: 'cssId', type: 'text', label: 'CSS ID' },
            { tab: 'advanced', section: 'Custom attributes', name: 'cssClasses', type: 'text', label: 'CSS classes' },
            { tab: 'advanced', section: 'Custom attributes', name: 'customAttributes', type: 'text', label: 'Custom attributes' },
        ],
        render: ({ domDocument }, node) => {
            const el = domDocument.createElement('a');
            el.className = 'ink-el-button';
            if (node.settings.size) el.classList.add(`is-size-${node.settings.size}`);
            if (node.settings.align) el.classList.add(`is-align-${node.settings.align}`);
            el.href = node.settings.url || '#'; el.target = node.settings.target || '_self';
            const label = domDocument.createElement('span'); label.className = 'ink-el-button-text'; label.textContent = node.settings.text || '';
            if (node.settings.icon) {
                const iconEl = domDocument.createElement('span'); iconEl.className = 'ink-el-button-icon'; iconEl.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">${node.settings.icon}</span>`;
                if (node.settings.iconPosition === 'after') { iconEl.classList.add('is-after'); el.appendChild(label); el.appendChild(iconEl); }
                else { el.appendChild(iconEl); el.appendChild(label); }
            } else {
                el.appendChild(label);
            }
            return el;
        },
    });
    registry.register({
        type: 'image', title: 'Image', icon: 'image', category: 'Basic',
        defaults: { settings: { src: '', alt: '', link: '', caption: '', align: '' }, styles: { base: { 'max-width': '100%', height: 'auto' } } },
        selectors: { root: '&', figure: '.ink-el-image-figure', image: '.ink-el-image', link: '.ink-el-image-link', caption: 'figcaption' },
        controls: [
            { tab: 'content', section: 'Image', name: 'src', type: 'media', label: 'Image' },
            { tab: 'content', section: 'Image', name: 'alt', type: 'text', label: 'Alternative text' },
            { tab: 'content', section: 'Image', name: 'link', type: 'url', label: 'Link' },
            { tab: 'content', section: 'Image', name: 'caption', type: 'text', label: 'Caption' },
            { tab: 'content', section: 'Image', name: 'align', type: 'choose', label: 'Alignment', options: [{ value: '', icon: 'format_align_left', label: 'Left' }, { value: 'center', icon: 'format_align_center', label: 'Center' }, { value: 'right', icon: 'format_align_right', label: 'Right' }] },
            { tab: 'style', target: 'styles', section: 'Image', name: 'object-fit', type: 'select', label: 'Object fit', options: ['cover', 'contain', 'fill', 'none'], part: 'image' },
            { tab: 'style', target: 'styles', section: 'Image', name: 'object-position', type: 'select', label: 'Object position', options: ['center', 'top', 'bottom', 'left', 'right'], part: 'image' },
            { tab: 'style', target: 'styles', section: 'Image', name: 'filter', type: 'css-filters', label: 'CSS filters', states: true, part: 'image' },
            { tab: 'style', target: 'styles', section: 'Image', name: 'border', type: 'border', label: 'Border', states: true, part: 'image' },
            { tab: 'style', target: 'styles', section: 'Image', name: 'border-radius', type: 'dimensions', label: 'Radius', units: ['px', 'rem', '%'], responsive: true, part: 'image' },
            { tab: 'style', target: 'styles', section: 'Image', name: 'caption-color', type: 'color', label: 'Caption color', property: 'color', part: 'caption' },
            ...advancedControls,
            { tab: 'advanced', section: 'Custom attributes', name: 'cssId', type: 'text', label: 'CSS ID' },
            { tab: 'advanced', section: 'Custom attributes', name: 'cssClasses', type: 'text', label: 'CSS classes' },
        ],
        render: ({ domDocument }, node) => {
            const image = domDocument.createElement('img'); image.className = 'ink-el-image'; image.src = node.settings.src || ''; image.alt = node.settings.alt || '';
            if (node.settings.cssId) image.id = node.settings.cssId;
            if (node.settings.cssClasses) image.classList.add(...String(node.settings.cssClasses).trim().split(/\s+/));
            const link = node.settings.link && typeof node.settings.link === 'object' ? node.settings.link.url : node.settings.link;
            const wrapper = domDocument.createElement('figure'); wrapper.className = 'ink-el-image-figure';
            if (link) {
                const anchor = domDocument.createElement('a'); anchor.href = link; anchor.className = 'ink-el-image-link'; anchor.appendChild(image); wrapper.appendChild(anchor);
            } else {
                wrapper.appendChild(image);
            }
            if (node.settings.align) { wrapper.classList.add(`is-align-${node.settings.align}`); image.classList.add(`is-align-${node.settings.align}`); }
            if (node.settings.caption) wrapper.appendChild(Object.assign(domDocument.createElement('figcaption'), { textContent: node.settings.caption }));
            return wrapper;
        },
    });
    registry.register({
        type: 'divider', title: 'Divider', icon: 'horizontal_rule', category: 'Basic',
        defaults: { settings: { weight: 1, align: '' }, styles: { base: { border: '0', 'border-top': '1px solid #7a7a7a', width: '100%' } } },
        controls: [
            { tab: 'content', section: 'Divider', name: 'align', type: 'choose', label: 'Alignment', options: [{ value: '', icon: 'format_align_left', label: 'Left' }, { value: 'center', icon: 'format_align_center', label: 'Center' }, { value: 'right', icon: 'format_align_right', label: 'Right' }] },
            { tab: 'style', target: 'styles', section: 'Divider', name: 'border-top', type: 'border', label: 'Color / weight' },
            { tab: 'style', target: 'styles', section: 'Divider', name: 'width', type: 'size', label: 'Width', units: ['px', '%'], responsive: true },
            { tab: 'style', target: 'styles', section: 'Divider', name: 'margin', type: 'dimensions', label: 'Gap', units: ['px', 'rem', 'em'], responsive: true },
            ...advancedControls,
        ],
        render: ({ domDocument }, node) => { const el = domDocument.createElement('hr'); el.className = 'ink-el-divider'; if (node.settings.align) el.classList.add(`is-align-${node.settings.align}`); if (node.settings.weight) el.style.borderTopWidth = `${node.settings.weight}px`; return el; },
    });
    registry.register({
        type: 'spacer', title: 'Spacer', icon: 'height', category: 'Basic',
        defaults: { settings: {}, styles: { base: { height: { size: 50, unit: 'px' } } } },
        controls: [{ tab: 'content', target: 'styles', section: 'Spacer', name: 'height', type: 'size', label: 'Space', units: ['px', 'vh'], responsive: true }],
        render: ({ domDocument }) => { const el = domDocument.createElement('div'); el.className = 'ink-el-spacer'; return el; },
    });
    return registry;
}
