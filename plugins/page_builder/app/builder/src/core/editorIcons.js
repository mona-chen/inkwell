import { renderIcon } from './icons.js';

// Persisted builder definitions historically use Material identifiers. They remain readable
// inputs, but the editor renders them as inline Lucide SVGs so icons cannot become text when
// an imported page changes typography.
const aliases = {
    add: 'plus', alternate_email: 'at-sign', anchor: 'anchor', arrow_back: 'arrow-left', arrow_downward: 'arrow-down', arrow_forward: 'arrow-right', arrow_upward: 'arrow-up',
    audio_file: 'file-audio', auto_awesome: 'sparkles', bottom_panel: 'panel-bottom', calendar_month: 'calendar-days', check: 'check', check_box_outline_blank: 'square',
    close: 'x', code: 'code-2', collections: 'images', contrast: 'contrast', conversion_path: 'workflow', crop_landscape: 'rectangle-horizontal', dashboard: 'layout-dashboard',
    data_object: 'braces', delete_sweep: 'trash-2', density_medium: 'grip', description: 'file-text', design_services: 'wand-sparkles', desktop: 'monitor', desktop_windows: 'monitor',
    dock_to_right: 'panel-right', drag_handle: 'grip-horizontal', draw: 'pencil', east: 'arrow-right', edit: 'pencil', error: 'circle-alert', expand_more: 'chevron-down',
    extension: 'puzzle', format_align_center: 'align-center', format_align_justify: 'align-justify', format_align_left: 'align-left', format_align_right: 'align-right',
    format_list_bulleted: 'list', format_quote: 'quote', gradient: 'blend', grid_4x4: 'grid-3x3', height: 'move-vertical', help: 'circle-help', history: 'history',
    horizontal_rule: 'minus', image: 'image', info: 'info', input: 'text-cursor-input', keyboard_return: 'corner-down-left', label: 'tag', language: 'globe-2',
    light_mode: 'sun', linear_scale: 'move-horizontal', link: 'link', lock: 'lock', lock_open: 'unlock', map: 'map', mobile: 'smartphone', more_horiz: 'ellipsis',
    more_vert: 'ellipsis-vertical', notes: 'notebook-text', notifications: 'bell', notifications_active: 'bell-ring', open_in_new: 'external-link', palette: 'palette',
    perm_media: 'images', photo: 'image', pin: 'map-pin', polyline: 'git-branch', preview: 'scan-eye', public: 'globe-2', publish: 'upload', radio_button_checked: 'circle-dot',
    read_more: 'arrow-right', redo: 'redo-2', restart_alt: 'rotate-ccw', save: 'save', search: 'search', settings: 'settings', share: 'share-2',
    smart_button: 'mouse-pointer-click', smart_display: 'square-play', smartphone: 'smartphone', space_bar: 'space', sparkles: 'sparkles', star: 'star', star_rate: 'star',
    subject: 'align-left', tab: 'panel-top', tablet: 'tablet', text_fields: 'type', title: 'heading', touch_app: 'mouse-pointer-click', tune: 'sliders-horizontal',
    undo: 'undo-2', vertical_align_bottom: 'align-end-vertical', vertical_align_center: 'align-center-vertical', vertical_align_top: 'align-start-vertical',
    view_carousel: 'gallery-horizontal', view_column: 'columns-3', view_week: 'columns-3', visibility: 'eye', visibility_off: 'eye-off', web_asset: 'panel-top', widgets: 'blocks', width: 'move-horizontal'
};

export function lucideName(name) {
    const key = String(name || '').trim();
    return aliases[key] || key.replace(/_/g, '-').replace(/^material:/, '') || 'square';
}

export function hydrateLucideIcon(wrapper) {
    if (!wrapper?.matches?.('.material-symbols-rounded')) return;
    const textName = wrapper.textContent.trim();
    const requested = textName || wrapper.dataset.inkLucideSource;
    if (!requested) return;
    if (wrapper.dataset.inkLucideSource === requested && wrapper.querySelector(':scope > .ink-lucide-icon')) return;
    const svg = renderIcon(wrapper.ownerDocument, `lucide:${lucideName(requested)}`, 'ink-lucide-icon');
    wrapper.replaceChildren(svg);
    wrapper.dataset.inkLucideSource = requested;
    wrapper.setAttribute('aria-hidden', 'true');
}

export function installLucideIcons(root = document, { filter } = {}) {
    const hydrate = (candidate) => {
        if (candidate?.matches?.('.material-symbols-rounded') && (!filter || filter(candidate))) hydrateLucideIcon(candidate);
        candidate?.querySelectorAll?.('.material-symbols-rounded').forEach((icon) => { if (!filter || filter(icon)) hydrateLucideIcon(icon); });
    };
    hydrate(root);
    const observer = new MutationObserver((records) => records.forEach((record) => {
        if (record.target?.matches?.('.material-symbols-rounded')) hydrate(record.target);
        record.addedNodes.forEach((node) => { if (node.nodeType === 1) hydrate(node); });
    }));
    observer.observe(root.documentElement || root, { childList: true, subtree: true });
    return observer;
}
