const make = (document, tag, className = '', text = null) => {
    const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node;
};
const icon = (document, name, className = '') => make(document, 'span', `material-symbols-rounded ${className}`, name || 'star');
const url = (value) => typeof value === 'object' ? value.url : value;

const spacing = [
    { tab: 'advanced', target: 'styles', section: 'Spacing', name: 'margin', type: 'dimensions', label: 'Margin', units: ['px', 'rem', '%'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Spacing', name: 'padding', type: 'dimensions', label: 'Padding', units: ['px', 'rem', '%'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'width', type: 'size', label: 'Width', units: ['px', '%', 'vw'], responsive: true },
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
    // Section: full-width bar, optional inner content width, vertical stack, accepts columns.
    register(registry, {
        type: 'section', title: 'Section', icon: 'crop_landscape', category: 'Layout', acceptsChildren: true,
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
        type: 'columns', title: 'Columns', icon: 'view_column', category: 'Layout', acceptsChildren: ['column'],
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
        type: 'column', title: 'Column', icon: 'view_week', category: 'Layout', acceptsChildren: true,
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
        render: ({ domDocument }, node) => { const root = make(domDocument, 'div', 'ink-el-text-editor'); root.innerHTML = node.settings.html || ''; return root; },
    });
    register(registry, {
        type: 'html', title: 'HTML', icon: 'code',
        defaults: { settings: { html: '<div>Custom HTML</div>' }, styles: { base: {} } },
        controls: [{ tab: 'content', section: 'HTML', name: 'html', type: 'code', label: 'HTML' }, ...spacing],
        render: ({ domDocument }, node) => { const root = make(domDocument, 'div', 'ink-el-html'); root.innerHTML = node.settings.html || ''; return root; },
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
        type,
        title: type === 'icon-box' ? 'Icon Box' : 'Image Box',
        icon: type === 'icon-box' ? 'featured_play_list' : 'image',
        defaults: { settings: { title: 'Feature title', description: 'A short description that explains this feature.', icon: 'auto_awesome', image: '', url: '' }, styles: { base: {} } },
        controls: [
            ...(type === 'icon-box' ? [{ tab: 'content', section: 'Content', name: 'icon', type: 'icon', label: 'Icon' }] : [{ tab: 'content', section: 'Content', name: 'image', type: 'media', label: 'Image' }]),
            { tab: 'content', section: 'Content', name: 'title', type: 'text', label: 'Title' },
            { tab: 'content', section: 'Content', name: 'description', type: 'textarea', label: 'Description' },
            { tab: 'content', section: 'Content', name: 'url', type: 'url', label: 'Link' },
            { tab: 'style', target: 'styles', section: 'Icon', name: 'color', type: 'color', label: 'Icon color' },
            { tab: 'style', target: 'styles', section: 'Icon', name: 'font-size', type: 'size', label: 'Icon size', units: ['px', 'rem'], responsive: true },
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
        controls: [items('items', [textField('text', 'Text'), textField('icon', 'Icon'), textField('url', 'URL')]), typographyControls, ...spacing],
        render: ({ domDocument }, node) => {
            const root = make(domDocument, 'ul', 'ink-el-icon-list');
            (node.settings.items || []).forEach((item) => {
                const li = make(domDocument, 'li');
                const itemUrl = url(item.url);
                if (itemUrl) { const link = make(domDocument, 'a'); link.href = itemUrl; link.append(icon(domDocument, item.icon), document.createTextNode(item.text)); li.appendChild(link); }
                else li.append(icon(domDocument, item.icon), document.createTextNode(item.text));
                root.append(li);
            });
            return root;
        },
    });
    register(registry, {
        type: 'counter', title: 'Counter', icon: 'pin',
        defaults: { settings: { number: '100', prefix: '', suffix: '+', title: 'Projects' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Counter', name: 'number', type: 'text', label: 'Number' },
            { tab: 'content', section: 'Counter', name: 'prefix', type: 'text', label: 'Prefix' },
            { tab: 'content', section: 'Counter', name: 'suffix', type: 'text', label: 'Suffix' },
            { tab: 'content', section: 'Counter', name: 'title', type: 'text', label: 'Title' },
            typographyControls, ...spacing,
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
        controls: [
            { tab: 'content', section: 'Progress', name: 'title', type: 'text', label: 'Title' },
            { tab: 'content', section: 'Progress', name: 'value', type: 'slider', label: 'Value', min: 0, max: 100 },
            { tab: 'style', target: 'styles', section: 'Progress', name: 'color', type: 'color', label: 'Bar color' },
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
        controls: [
            { tab: 'content', section: 'Rating', name: 'rating', type: 'slider', label: 'Rating', min: 0, max: 5, step: 0.5 },
            { tab: 'content', section: 'Rating', name: 'label', type: 'text', label: 'Accessible label' },
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
        controls: [
            { tab: 'content', section: 'Testimonial', name: 'quote', type: 'textarea', label: 'Quote' },
            { tab: 'content', section: 'Testimonial', name: 'name', type: 'text', label: 'Name' },
            { tab: 'content', section: 'Testimonial', name: 'role', type: 'text', label: 'Role' },
            { tab: 'content', section: 'Testimonial', name: 'avatar', type: 'media', label: 'Avatar' },
            typographyControls, ...spacing,
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
        controls: [items('items', [textField('title', 'Title'), textField('content', 'Content', 'textarea')]), ...spacing],
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
        controls: [items('items', [textField('title', 'Title'), textField('content', 'Content', 'textarea')]), ...spacing],
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
        type: 'alert', title: 'Alert', icon: 'info',
        defaults: { settings: { title: 'Notice', message: 'This is an important message.', type: 'info' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Alert', name: 'title', type: 'text', label: 'Title' },
            { tab: 'content', section: 'Alert', name: 'message', type: 'textarea', label: 'Message' },
            { tab: 'content', section: 'Alert', name: 'type', type: 'select', label: 'Type', options: ['info', 'success', 'warning', 'danger'] },
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
                const prev = make(domDocument, 'button', 'ink-el-carousel-nav is-prev'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous slide'); prev.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>';
                const next = make(domDocument, 'button', 'ink-el-carousel-nav is-next'); next.type = 'button'; next.setAttribute('aria-label', 'Next slide'); next.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>';
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
