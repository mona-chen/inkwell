const el = (document, tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
};

const files = [
    { name: 'bitcoin.pdf', body: 'Bitcoin is a cryptocurrency invented in 2008 by an unknown person or group using the name Satoshi Nakamoto.' },
    { name: 'finances.xlsx', body: 'A spreadsheet is a file made of rows and columns that helps sort, arrange, and calculate data.' },
    { name: 'logo.svg', body: 'Scalable Vector Graphics is an XML-based vector image format with support for interactivity and animation.' },
    { name: 'keys.gpg', body: 'GPG keys encrypt and decrypt files and authenticate messages.' },
];

const notifications = [
    { icon: '📜', title: 'New event', time: '2m ago', body: 'Magic UI' },
    { icon: '💬', title: 'New message', time: '5m ago', body: 'Magic UI' },
    { icon: '👤', title: 'User signed up', time: '10m ago', body: 'Magic UI' },
];

const commonAdvanced = [
    { tab: 'advanced', target: 'styles', section: 'Spacing', name: 'margin', type: 'dimensions', label: 'Margin', units: ['px', 'rem', '%'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Spacing', name: 'padding', type: 'dimensions', label: 'Padding', units: ['px', 'rem', '%'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'width', type: 'size', label: 'Width', units: ['px', '%', 'vw'], responsive: true },
    { tab: 'advanced', target: 'styles', section: 'Layout', name: 'max-width', type: 'size', label: 'Maximum width', units: ['px', '%', 'rem'], responsive: true },
];

function renderMarquee(document, items, { vertical = false, reverse = false, pauseOnHover = true, duration = 40 } = {}) {
    const root = el(document, 'div', `ink-magic-marquee${vertical ? ' is-vertical' : ''}${reverse ? ' is-reverse' : ''}${pauseOnHover ? ' pause-on-hover' : ''}`);
    root.style.setProperty('--magic-duration', `${duration}s`);
    for (let repeat = 0; repeat < 4; repeat += 1) {
        const track = el(document, 'div', 'ink-magic-marquee-track');
        items.forEach((item) => {
            const card = el(document, 'figure', 'ink-magic-file-card');
            card.append(el(document, 'figcaption', '', item.name), el(document, 'blockquote', '', item.body)); track.appendChild(card);
        });
        root.appendChild(track);
    }
    return root;
}

function renderNotifications(document, items, delay = 1000) {
    const root = el(document, 'div', 'ink-magic-list'); root.style.setProperty('--magic-list-delay', `${delay}ms`);
    items.forEach((item, index) => {
        const row = el(document, 'div', 'ink-magic-notification'); row.style.setProperty('--magic-list-index', index);
        row.append(el(document, 'span', 'ink-magic-notification-icon', item.icon));
        const copy = el(document, 'div'); const title = el(document, 'strong', '', item.title); title.append(el(document, 'small', '', ` · ${item.time}`)); copy.append(title, el(document, 'span', '', item.body)); row.appendChild(copy); root.appendChild(row);
    });
    return root;
}

function renderBeam(document) {
    const root = el(document, 'div', 'ink-magic-beam');
    const source = el(document, 'span', 'ink-magic-beam-node is-source', '◎'); root.appendChild(source);
    const targets = [['drive', '▲'], ['docs', '▤'], ['chat', '●'], ['message', '◆']];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 620 250'); svg.classList.add('ink-magic-beam-lines');
    const defs = document.createElementNS(svg.namespaceURI, 'defs'); defs.innerHTML = '<linearGradient id="ink-beam-gradient"><stop stop-color="#ffaa40" stop-opacity="0"/><stop offset=".35" stop-color="#ffaa40"/><stop offset=".68" stop-color="#9c40ff"/><stop offset="1" stop-color="#9c40ff" stop-opacity="0"/></linearGradient>'; svg.appendChild(defs);
    targets.forEach(([, icon], index) => { const y = 35 + index * 60; const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', `M 165 125 Q 305 ${y} 455 ${y}`); path.classList.add('ink-magic-beam-path'); svg.appendChild(path); const node = el(document, 'span', 'ink-magic-beam-node is-target', icon); node.style.top = `${y - 25}px`; root.appendChild(node); });
    root.appendChild(svg); return root;
}

function renderCalendar(document) {
    const root = el(document, 'div', 'ink-magic-calendar'); root.append(el(document, 'strong', '', 'August 2026'), el(document, 'div', 'ink-magic-calendar-week', 'Su Mo Tu We Th Fr Sa'));
    const days = el(document, 'div', 'ink-magic-calendar-days'); ['26', '27', '28', '29', '30', '31', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'].forEach((day) => days.append(el(document, 'span', day === '11' ? 'is-selected' : '', day))); root.appendChild(days); return root;
}

function renderBentoCard(document, feature) {
    const card = el(document, 'article', `ink-magic-bento-card ${feature.span || ''}`);
    const visual = el(document, 'div', 'ink-magic-bento-visual');
    if (feature.visual === 'files') visual.appendChild(renderMarquee(document, files, { duration: 20 }));
    if (feature.visual === 'notifications') visual.appendChild(renderNotifications(document, notifications));
    if (feature.visual === 'beam') visual.appendChild(renderBeam(document));
    if (feature.visual === 'calendar') visual.appendChild(renderCalendar(document));
    const copy = el(document, 'div', 'ink-magic-bento-copy'); copy.append(el(document, 'span', 'material-symbols-rounded ink-magic-bento-icon', feature.icon), el(document, 'h3', '', feature.name), el(document, 'p', '', feature.description));
    const link = el(document, 'a', 'ink-magic-bento-link', `${feature.cta || 'Learn more'}  →`); link.href = feature.href || '#'; copy.appendChild(link); card.append(visual, copy); return card;
}

export default function registerInkMagicElements(registry) {
    registry.register({
        type: 'aurora-text', title: 'Aurora Text', icon: 'gradient', category: 'Magic UI', inlineEditable: '.ink-magic-aurora-accent',
        defaults: { settings: { prefix: 'Ship', text: 'beautiful', colors: '#FF0080,#7928CA,#0070F3,#38bdf8', speed: 1, tag: 'h2' }, styles: { base: {} } },
        controls: [
            { tab: 'content', section: 'Content', name: 'prefix', type: 'text', label: 'Prefix' }, { tab: 'content', section: 'Content', name: 'text', type: 'text', label: 'Aurora text' },
            { tab: 'content', section: 'Content', name: 'tag', type: 'select', label: 'HTML tag', options: ['h1', 'h2', 'h3', 'div', 'span'] }, { tab: 'style', target: 'settings', section: 'Aurora', name: 'colors', type: 'text', label: 'Gradient colors' },
            { tab: 'style', target: 'settings', section: 'Aurora', name: 'speed', type: 'slider', label: 'Speed', min: .25, max: 3, step: .25 }, { tab: 'style', target: 'styles', section: 'Typography', name: 'font-size', type: 'size', label: 'Size', units: ['px', 'rem', 'vw'], responsive: true },
            ...commonAdvanced,
        ],
        render: ({ domDocument }, node) => { const root = el(domDocument, node.settings.tag || 'h2', 'ink-magic-aurora-text'); const prefix = el(domDocument, 'span', '', node.settings.prefix); const accent = el(domDocument, 'span', 'ink-magic-aurora-accent', node.settings.text); accent.style.setProperty('--magic-aurora-colors', `${node.settings.colors},${String(node.settings.colors).split(',')[0]}`); accent.style.setProperty('--magic-aurora-duration', `${10 / (Number(node.settings.speed) || 1)}s`); root.append(prefix, accent); return root; },
    });
    registry.register({
        type: 'retro-grid', title: 'Retro Grid', icon: 'grid_4x4', category: 'Magic UI', inlineEditable: '.ink-magic-retro-title',
        defaults: { settings: { text: 'Retro Grid', angle: 65, cellSize: 60, opacity: .5, lineColor: '#808080' }, styles: { base: { height: { size: 500, unit: 'px' } } } },
        controls: [{ tab: 'content', section: 'Content', name: 'text', type: 'text', label: 'Title' }, { tab: 'style', target: 'settings', section: 'Grid', name: 'angle', type: 'slider', label: 'Angle', min: 1, max: 89 }, { tab: 'style', target: 'settings', section: 'Grid', name: 'cellSize', type: 'slider', label: 'Cell size', min: 20, max: 120 }, { tab: 'style', target: 'settings', section: 'Grid', name: 'opacity', type: 'slider', label: 'Opacity', min: 0, max: 1, step: .05 }, { tab: 'style', target: 'settings', section: 'Grid', name: 'lineColor', type: 'color', label: 'Line color' }, ...commonAdvanced],
        render: ({ domDocument }, node) => { const root = el(domDocument, 'section', 'ink-magic-retro'); root.style.cssText = `--magic-retro-angle:${Number(node.settings.angle) || 65}deg;--magic-retro-cell:${Number(node.settings.cellSize) || 60}px;--magic-retro-opacity:${Number.isFinite(Number(node.settings.opacity)) ? Number(node.settings.opacity) : .5};--magic-retro-line:${node.settings.lineColor || '#808080'}`; root.append(el(domDocument, 'span', 'ink-magic-retro-title', node.settings.text)); const perspective = el(domDocument, 'div', 'ink-magic-retro-perspective'); perspective.append(el(domDocument, 'div', 'ink-magic-retro-scroll')); root.append(perspective, el(domDocument, 'div', 'ink-magic-retro-fade')); return root; },
    });
    registry.register({
        type: 'marquee', title: 'Marquee', icon: 'view_carousel', category: 'Magic UI',
        defaults: { settings: { items: files, duration: 40, vertical: false, reverse: false, pauseOnHover: true }, styles: { base: {} } },
        controls: [{ tab: 'content', section: 'Items', name: 'items', type: 'repeater', label: 'Items', titleField: 'name', fields: [{ name: 'name', label: 'Title', type: 'text' }, { name: 'body', label: 'Body', type: 'textarea' }] }, { tab: 'content', section: 'Animation', name: 'vertical', type: 'switcher', label: 'Vertical' }, { tab: 'content', section: 'Animation', name: 'reverse', type: 'switcher', label: 'Reverse' }, { tab: 'content', section: 'Animation', name: 'pauseOnHover', type: 'switcher', label: 'Pause on hover' }, { tab: 'content', section: 'Animation', name: 'duration', type: 'slider', label: 'Duration', min: 5, max: 120 }, ...commonAdvanced],
        render: ({ domDocument }, node) => renderMarquee(domDocument, node.settings.items || files, node.settings),
    });
    registry.register({
        type: 'animated-list', title: 'Animated List', icon: 'notifications_active', category: 'Magic UI',
        defaults: { settings: { items: notifications, delay: 1000 }, styles: { base: {} } },
        controls: [{ tab: 'content', section: 'Items', name: 'items', type: 'repeater', label: 'Notifications', titleField: 'title', fields: [{ name: 'icon', label: 'Icon', type: 'text' }, { name: 'title', label: 'Title', type: 'text' }, { name: 'time', label: 'Time', type: 'text' }, { name: 'body', label: 'Body', type: 'text' }] }, { tab: 'content', section: 'Animation', name: 'delay', type: 'slider', label: 'Delay', min: 100, max: 5000, step: 100 }, ...commonAdvanced],
        render: ({ domDocument }, node) => renderNotifications(domDocument, node.settings.items || notifications, node.settings.delay),
    });
    registry.register({
        type: 'animated-beam', title: 'Animated Beam', icon: 'conversion_path', category: 'Magic UI', defaults: { settings: {}, styles: { base: { height: { size: 300, unit: 'px' } } } }, controls: [...commonAdvanced], render: ({ domDocument }) => renderBeam(domDocument),
    });
    registry.register({
        type: 'bento-grid', title: 'Bento Grid', icon: 'dashboard', category: 'Magic UI',
        defaults: { settings: { features: [{ name: 'Save your files', description: 'We automatically save your files as you type.', icon: 'description', visual: 'files', span: 'is-narrow', cta: 'Learn more' }, { name: 'Notifications', description: 'Get notified when something happens.', icon: 'notifications', visual: 'notifications', span: 'is-wide', cta: 'Learn more' }, { name: 'Integrations', description: 'Supports 100+ integrations and counting.', icon: 'share', visual: 'beam', span: 'is-wide', cta: 'Learn more' }, { name: 'Calendar', description: 'Use the calendar to filter your files by date.', icon: 'calendar_month', visual: 'calendar', span: 'is-narrow', cta: 'Learn more' }] }, styles: { base: {} } },
        controls: [{ tab: 'content', section: 'Cards', name: 'features', type: 'repeater', label: 'Cards', titleField: 'name', minItems: 1, fields: [{ name: 'name', label: 'Title', type: 'text' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'icon', label: 'Icon', type: 'text' }, { name: 'visual', label: 'Visual', type: 'select', options: ['files', 'notifications', 'beam', 'calendar'] }, { name: 'span', label: 'Size', type: 'select', options: ['is-narrow', 'is-wide'] }, { name: 'cta', label: 'CTA', type: 'text' }] }, ...commonAdvanced],
        render: ({ domDocument }, node) => { const root = el(domDocument, 'section', 'ink-magic-bento-grid'); (node.settings.features || []).forEach((feature) => root.appendChild(renderBentoCard(domDocument, feature))); return root; },
    });
    return registry;
}
