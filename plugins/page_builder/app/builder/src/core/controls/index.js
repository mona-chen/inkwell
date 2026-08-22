// Standalone control renderers — independent implementations with a uniform contract:
//   render(panel, control, node, value, row) => row
// PanelManager stays thin: renderControl() delegates here via the ControlRegistry.
// Each renderer uses only the panel context (setValue/currentValue/renderControl/
// runtime) — no private PanelManager state.

import { pickMedia, uploadMedia } from '../MediaPicker.js';
import { RichTextAdapter } from '../RichTextAdapter.js';
import { iconNames, iconCount, iconValue, resolveIcon, renderIcon, libraryTitle } from '../icons.js';
import { GOOGLE_FONTS } from '../fonts.js';
import { ELEMENTOR_SHAPES } from '../elementorShapes.js';

const labelFor = (option) => typeof option === 'object' ? option.label : String(option).replace(/-/g, ' ');
const valueFor = (option) => typeof option === 'object' ? option.value : option;

/* ------------------------------------------------------------------ *
 * Switcher / slider / gaps / dimensions (value editors)
 * ------------------------------------------------------------------ */

export function switcher(panel, control, node, value, row) {
    const wrapper = document.createElement('label'); wrapper.className = 'ink-v2-switch';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = (value === '' || value === undefined) && control.default !== undefined ? !!control.default : value === true || value === control.returnValue || value === 'yes';
    const track = document.createElement('span'); track.dataset.on = control.onLabel || 'Yes'; track.dataset.off = control.offLabel || 'No';
    checkbox.addEventListener('change', () => panel.setValue(control, node, checkbox.checked ? (control.returnValue ?? true) : (control.offValue ?? false)));
    wrapper.append(checkbox, track); row.appendChild(wrapper); return row;
}

export function slider(panel, control, node, value, row) {
    const host = document.createElement('div'); host.className = 'ink-v2-slider';
    const range = document.createElement('input'); range.type = 'range'; range.min = control.min ?? 0; range.max = control.max ?? 100; range.step = control.step ?? 1;
    const number = document.createElement('input'); number.type = 'number'; number.min = range.min; number.max = range.max; number.step = range.step;
    const size = value && typeof value === 'object' ? value.size : value;
    const initial = size === '' || size === undefined || size === null ? (control.default ?? control.min ?? 0) : size;
    range.value = initial; number.value = range.value;
    const unit = control.units ? document.createElement('select') : null;
    if (unit) { unit.className = 'ink-v2-unit'; control.units.forEach((name) => unit.add(new Option(name, name))); unit.value = value?.unit || control.units[0]; }
    const commit = (source) => { if (source) { range.value = source.value; number.value = source.value; } panel.setValue(control, node, unit ? { size: Number(number.value), unit: unit.value } : Number(number.value)); };
    range.addEventListener('input', () => { number.value = range.value; });
    range.addEventListener('change', () => commit(range)); number.addEventListener('change', () => commit(number)); unit?.addEventListener('change', () => commit());
    host.append(range, number); if (unit) host.appendChild(unit); row.appendChild(host); return row;
}

export function gaps(panel, control, node, value, row) {
    const gaps = value && typeof value === 'object' ? value : {};
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-gaps';
    const rowGap = document.createElement('input'); rowGap.type = 'number'; rowGap.placeholder = 'Row'; rowGap.value = gaps.row ?? '';
    const columnGap = document.createElement('input'); columnGap.type = 'number'; columnGap.placeholder = 'Column'; columnGap.value = gaps.column ?? '';
    const unit = document.createElement('select'); (control.units || ['px']).forEach((name) => unit.add(new Option(name, name))); unit.value = gaps.unit || control.units?.[0] || 'px';
    let linked = gaps.linked !== false; const link = document.createElement('button'); link.type = 'button'; link.className = 'ink-v2-link-values'; link.title = 'Link row and column gap'; link.setAttribute('aria-label', link.title); link.innerHTML = '<span class="material-symbols-rounded">link</span>'; link.classList.toggle('is-active', linked);
    const commit = (source) => { if (linked && source === rowGap) columnGap.value = rowGap.value; if (linked && source === columnGap) rowGap.value = columnGap.value; panel.setValue(control, node, { row: Number(rowGap.value) || 0, column: Number(columnGap.value) || 0, unit: unit.value, linked }); };
    link.addEventListener('click', () => { linked = !linked; link.classList.toggle('is-active', linked); if (linked) { columnGap.value = rowGap.value; commit(); } });
    rowGap.addEventListener('change', () => commit(rowGap)); columnGap.addEventListener('change', () => commit(columnGap)); unit.addEventListener('change', () => commit()); wrapper.append(rowGap, columnGap, unit, link); row.appendChild(wrapper); return row;
}

export function dimensions(panel, control, node, value, row) {
    const dimensions = value && typeof value === 'object' ? value : {};
    const inputs = document.createElement('div'); inputs.className = 'ink-v2-dimensions';
    let linked = dimensions.linked !== false;
    ['top', 'right', 'bottom', 'left'].forEach((side) => {
        const field = document.createElement('label'); field.innerHTML = `<span>${side[0].toUpperCase()}</span>`;
        const input = document.createElement('input'); input.type = 'number'; input.value = dimensions[side] ?? '';
        field.prepend(input); inputs.appendChild(field);
    });
    const unit = document.createElement('select'); unit.className = 'ink-v2-unit';
    (control.units || ['px']).forEach((name) => { const option = document.createElement('option'); option.value = name; option.textContent = name; unit.appendChild(option); });
    unit.value = dimensions.unit || control.units?.[0] || 'px'; inputs.appendChild(unit);
    const link = document.createElement('button'); link.type = 'button'; link.className = 'ink-v2-link-values'; link.title = 'Link values'; link.setAttribute('aria-label', 'Link spacing values'); link.innerHTML = '<span class="material-symbols-rounded">link</span>'; link.classList.toggle('is-active', linked); inputs.appendChild(link);
    const commit = (source) => {
        const sides = inputs.querySelectorAll('input');
        if (linked && source) sides.forEach((input) => { if (input !== source) input.value = source.value; });
        panel.setValue(control, node, { top: Number(sides[0].value) || 0, right: Number(sides[1].value) || 0, bottom: Number(sides[2].value) || 0, left: Number(sides[3].value) || 0, unit: unit.value, linked });
    };
    inputs.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => commit(input))); unit.addEventListener('change', () => commit()); link.addEventListener('click', () => { linked = !linked; link.classList.toggle('is-active', linked); if (linked) commit(inputs.querySelector('input')); });
    row.appendChild(inputs); return row;
}

export function color(panel, control, node, value, row) {
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-color-control';
    const globals = panel.runtime.document.data.settings.theme?.colors || {};
    const palette = { primary: '#2563eb', secondary: '#7c3aed', text: '#18181b', accent: '#f59e0b', ...globals };
    const swatches = document.createElement('div'); swatches.className = 'ink-v2-global-colors';
    Object.entries(palette).forEach(([name, color]) => {
        const button = document.createElement('button'); button.type = 'button'; button.title = `Global ${name}`; button.setAttribute('aria-label', `Use global ${name}`); button.style.setProperty('--swatch', color); button.classList.toggle('is-active', value === `var(--ink-color-${name})`); button.addEventListener('click', () => panel.setValue(control, node, `var(--ink-color-${name})`)); swatches.appendChild(button);
    });
    const custom = document.createElement('div'); custom.className = 'ink-v2-custom-color';
    const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
    const alpha = document.createElement('input'); alpha.type = 'range'; alpha.min = 0; alpha.max = 100; alpha.value = 100; alpha.title = 'Opacity';
    const commit = () => { const hex = colorInput.value; const opacity = Number(alpha.value) / 100; if (opacity === 1) panel.setValue(control, node, hex); else { const parts = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)); panel.setValue(control, node, `rgba(${parts.join(',')},${opacity})`); } };
    colorInput.addEventListener('change', commit); alpha.addEventListener('change', commit); custom.append(colorInput, alpha); wrapper.append(swatches, custom); row.appendChild(wrapper); return row;
}

export function cssFilters(panel, control, node, value, row) {
    const filters = value && typeof value === 'object' ? value : {};
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-css-filters';
    [['blur', 0, 20, 1], ['brightness', 0, 200, 5], ['contrast', 0, 200, 5], ['saturate', 0, 200, 5], ['hue', 0, 360, 5]].forEach(([name, min, max, step]) => {
        const label = document.createElement('label'); label.textContent = name; const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = filters[name] ?? (name === 'blur' || name === 'hue' ? 0 : 100); input.dataset.filter = name; label.appendChild(input); wrapper.appendChild(label);
    });
    const commit = () => { const next = {}; wrapper.querySelectorAll('[data-filter]').forEach((input) => { next[input.dataset.filter] = Number(input.value); }); panel.setValue(control, node, next); };
    wrapper.querySelectorAll('input').forEach((input) => input.addEventListener('change', commit)); row.appendChild(wrapper); return row;
}

export function textStroke(panel, control, node, value, row) {
    const stroke = value && typeof value === 'object' ? value : {}; const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-text-stroke';
    const width = document.createElement('input'); width.type = 'number'; width.min = 0; width.value = stroke.strokeWidth ?? 0; const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = /^#[0-9a-f]{6}$/i.test(stroke.color || '') ? stroke.color : '#000000';
    const commit = () => panel.setValue(control, node, { strokeWidth: Number(width.value) || 0, unit: 'px', color: colorInput.value }); width.addEventListener('change', commit); colorInput.addEventListener('change', commit); wrapper.append(width, colorInput); row.appendChild(wrapper); return row;
}

export function gradient(panel, control, node, value, row) {
    const parsed = (() => { const m = /^(linear-gradient)\((\d+)deg,\s*([^,]+),\s*([^)]+)\)$/.exec(String(value || '')); if (!m) return null; return { angle: Number(m[2]), from: m[3].trim(), to: m[4].trim() }; })();
    const angle = document.createElement('input'); angle.type = 'number'; angle.min = 0; angle.max = 360; angle.value = parsed?.angle ?? 90;
    const from = document.createElement('input'); from.type = 'color'; from.value = /^#[0-9a-f]{6}$/i.test(parsed?.from || '') ? parsed.from : '#6ec1e4';
    const to = document.createElement('input'); to.type = 'color'; to.value = /^#[0-9a-f]{6}$/i.test(parsed?.to || '') ? parsed.to : '#4054b2';
    const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Remove'; clear.disabled = !value;
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-gradient';
    const commit = () => panel.setValue(control, node, `linear-gradient(${Number(angle.value) || 90}deg, ${from.value}, ${to.value})`);
    angle.addEventListener('change', commit); from.addEventListener('change', commit); to.addEventListener('change', commit);
    clear.addEventListener('click', () => panel.setValue(control, node, ''));
    wrapper.append(angle, from, to, clear); row.appendChild(wrapper); return row;
}

/* ------------------------------------------------------------------ *
 * Media / gallery / dimensions / url / icon
 * ------------------------------------------------------------------ */

export function media(panel, control, node, value, row) {
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-media';
    const url = typeof value === 'object' ? value?.url || '' : value || '';
    const preview = document.createElement('div'); preview.className = 'ink-v2-media-preview';
    if (/^linear-gradient\(/.test(url) || /^radial-gradient\(/.test(url)) { preview.style.background = url; preview.style.backgroundSize = 'cover'; preview.innerHTML = '<span>Gradient background</span>'; }
    else if (url && /\.(mp4|webm|ogg)(\?|$)/i.test(url)) { const video = document.createElement('video'); video.src = url; video.muted = true; preview.appendChild(video); }
    else if (url) { const image = document.createElement('img'); image.src = url; image.alt = ''; preview.appendChild(image); }
    else preview.innerHTML = '<span>No media selected</span>';
    const actions = document.createElement('div'); actions.className = 'ink-v2-media-actions';
    const mediaValue = (current, next) => current && typeof current === 'object' && !Array.isArray(current) ? { ...current, url: next } : next;
    const library = document.createElement('button'); library.type = 'button'; library.textContent = 'Choose'; library.addEventListener('click', () => pickMedia((next) => panel.setValue(control, node, mediaValue(value, next))));
    const upload = document.createElement('button'); upload.type = 'button'; upload.textContent = 'Upload'; upload.addEventListener('click', () => uploadMedia(panel.runtime.assetUploadHandler, control.accept, (next) => panel.setValue(control, node, mediaValue(value, next))));
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.disabled = !url; remove.addEventListener('click', () => panel.setValue(control, node, mediaValue(value, '')));
    actions.append(library, upload, remove); wrapper.append(preview, actions); row.appendChild(wrapper); return row;
}

export function gallery(panel, control, node, value, row) {
    const images = Array.isArray(value) ? value : [];
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-gallery';
    const thumbnails = document.createElement('div'); thumbnails.className = 'ink-v2-gallery-thumbnails';
    images.forEach((item, index) => {
        const tile = document.createElement('button'); tile.type = 'button'; tile.title = 'Remove image';
        const image = document.createElement('img'); image.src = typeof item === 'string' ? item : item.url; image.alt = ''; tile.appendChild(image);
        tile.addEventListener('click', () => panel.setValue(control, node, images.filter((_, cursor) => cursor !== index))); thumbnails.appendChild(tile);
    });
    const actions = document.createElement('div'); actions.className = 'ink-v2-media-actions';
    const add = document.createElement('button'); add.type = 'button'; add.textContent = 'Add images'; add.addEventListener('click', () => pickMedia((url) => panel.setValue(control, node, [...images, { url }])));
    const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Clear'; clear.disabled = !images.length; clear.addEventListener('click', () => panel.setValue(control, node, []));
    actions.append(add, clear); wrapper.append(thumbnails, actions); row.appendChild(wrapper); return row;
}

export function imageDimensions(panel, control, node, value, row) {
    const dimensions = value && typeof value === 'object' ? value : {};
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-image-dimensions';
    const width = document.createElement('input'); width.type = 'number'; width.placeholder = 'Width'; width.value = dimensions.width ?? '';
    const height = document.createElement('input'); height.type = 'number'; height.placeholder = 'Height'; height.value = dimensions.height ?? '';
    const unit = document.createElement('select'); (control.units || ['px', '%']).forEach((name) => unit.add(new Option(name, name))); unit.value = dimensions.unit || control.units?.[0] || 'px';
    const commit = () => panel.setValue(control, node, { width: Number(width.value) || 0, height: Number(height.value) || 0, unit: unit.value });
    [width, height, unit].forEach((input) => input.addEventListener('change', commit)); wrapper.append(width, height, unit); row.appendChild(wrapper); return row;
}

export function url(panel, control, node, value, row) {
    const link = value && typeof value === 'object' ? value : { url: value || '' };
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-url';
    const input = document.createElement('input'); input.type = 'url'; input.placeholder = 'https://'; input.value = link.url || '';
    const options = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '⚙'; options.appendChild(summary);
    [['isExternal', 'Open in new window'], ['nofollow', 'Add nofollow']].forEach(([name, text]) => { const label = document.createElement('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!link[name]; checkbox.dataset.urlOption = name; label.append(checkbox, text); options.appendChild(label); });
    const attributes = document.createElement('input'); attributes.type = 'text'; attributes.placeholder = 'key|value, key|value'; attributes.value = link.customAttributes || ''; attributes.dataset.urlAttributes = ''; options.appendChild(attributes);
    const commit = () => { const next = { url: input.value, customAttributes: attributes.value }; options.querySelectorAll('[data-url-option]').forEach((checkbox) => { next[checkbox.dataset.urlOption] = checkbox.checked; }); panel.setValue(control, node, control.multiple || typeof value === 'object' ? next : next.url); };
    input.addEventListener('change', commit); options.querySelectorAll('input').forEach((field) => field.addEventListener('change', commit)); wrapper.append(input, options); row.appendChild(wrapper); return row;
}

export function icon(panel, control, node, value, row) {
    row.classList.add('ink-v2-icons');
    const resolved = resolveIcon(value);
    const libraries = ['material', 'phosphor', 'lucide'];
    const tabs = document.createElement('div'); tabs.className = 'ink-v2-icon-libs';
    let active = libraries.includes(resolved.library) ? resolved.library : 'material';
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search icons'; search.className = 'ink-v2-icon-search';
    const grid = document.createElement('div'); grid.className = 'ink-v2-icon-grid';
    const draw = () => {
        grid.replaceChildren();
        const all = iconNames(active);
        const query = search.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
        const shown = query ? all.filter((name) => name.includes(query)) : all.slice(0, 200);
        if (!shown.length) { grid.innerHTML = '<span class="ink-v2-icon-empty">No icons match</span>'; return; }
        shown.forEach((name) => {
            const button = document.createElement('button'); button.type = 'button'; button.title = name; button.className = resolved.library === active && resolved.name === name ? 'is-active' : '';
            button.setAttribute('aria-label', name);
            button.appendChild(renderIcon(document, iconValue(active, name)));
            button.addEventListener('click', () => panel.setValue(control, node, iconValue(active, name)));
            grid.appendChild(button);
        });
    };
    libraries.forEach((library) => {
        const tab = document.createElement('button'); tab.type = 'button'; tab.textContent = `${libraryTitle(library)} · ${iconCount(library)}`; tab.className = library === active ? 'is-active' : '';
        tab.addEventListener('click', () => { active = library; tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === tab)); draw(); });
        tabs.appendChild(tab);
    });
    search.addEventListener('input', draw);
    draw();
    const custom = document.createElement('input'); custom.type = 'text'; custom.placeholder = 'Icon name (material) or lucide:name'; custom.value = typeof value === 'string' ? value : ''; custom.addEventListener('change', () => panel.setValue(control, node, custom.value));
    row.append(tabs, search, grid, custom); return row;
}

/* ------------------------------------------------------------------ *
 * Shadow / border / repeater
 * ------------------------------------------------------------------ */

export function shadow(panel, control, node, value, row) {
    const shadow = value && typeof value === 'object' ? value : {};
    const enabled = Object.keys(shadow).length > 0;
    const controlHost = document.createElement('div'); controlHost.className = 'ink-v2-shadow-control';
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'ink-v2-shadow-toggle'; toggle.title = enabled ? 'Remove box shadow' : 'Edit box shadow'; toggle.setAttribute('aria-label', toggle.title);
    toggle.innerHTML = `<span class="material-symbols-rounded">${enabled ? 'close' : 'edit'}</span>`;
    toggle.addEventListener('click', () => panel.setValue(control, node, enabled ? '' : { x: 0, y: 0, blur: 10, spread: 0, unit: 'px', color: '#000000', inset: false }));
    controlHost.appendChild(toggle);
    if (!enabled) { row.appendChild(controlHost); return row; }
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-shadow';
    ['x', 'y', 'blur', ...(control.type === 'box-shadow' ? ['spread'] : [])].forEach((name) => {
        const field = document.createElement('label'); field.textContent = name;
        const input = document.createElement('input'); input.type = 'number'; input.value = shadow[name] ?? 0; input.dataset.shadowField = name; field.prepend(input); wrapper.appendChild(field);
    });
    const colorField = document.createElement('label'); colorField.className = 'ink-v2-shadow-color'; colorField.textContent = 'Color';
    const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = /^#[0-9a-f]{6}$/i.test(shadow.color || '') ? shadow.color : '#000000'; colorInput.dataset.shadowField = 'color'; colorField.prepend(colorInput); wrapper.appendChild(colorField);
    if (control.type === 'box-shadow') {
        const position = document.createElement('label'); position.className = 'ink-v2-shadow-position'; position.textContent = 'Position';
        const select = document.createElement('select'); select.dataset.shadowPosition = ''; select.add(new Option('Outline', 'outline')); select.add(new Option('Inset', 'inset')); select.value = shadow.inset ? 'inset' : 'outline'; position.prepend(select); wrapper.appendChild(position);
    }
    const commit = () => { const next = { unit: shadow.unit || 'px' }; wrapper.querySelectorAll('[data-shadow-field]').forEach((input) => { next[input.dataset.shadowField] = input.type === 'number' ? Number(input.value) : input.value; }); next.inset = wrapper.querySelector('[data-shadow-position]')?.value === 'inset'; panel.setValue(control, node, next); };
    wrapper.querySelectorAll('input, select').forEach((input) => input.addEventListener('change', commit)); controlHost.appendChild(wrapper); row.appendChild(controlHost); return row;
}

export function border(panel, control, node, value, row) {
    row.classList.add('ink-v2-control-group');
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-border';
    const styleControl = { ...control, name: 'border-style', type: 'select' };
    const legacy = value && typeof value === 'object' ? value : {};
    const current = panel.currentValue(styleControl, node) || legacy.style || '';
    const style = document.createElement('select');
    [["", 'Default'], ['none', 'None'], ['solid', 'Solid'], ['double', 'Double'], ['dotted', 'Dotted'], ['dashed', 'Dashed'], ['groove', 'Groove']].forEach(([name, label]) => style.add(new Option(label, name)));
    style.value = current; style.addEventListener('change', () => panel.setValue(styleControl, node, style.value)); wrapper.appendChild(style);
    if (current && current !== 'none') {
        const nested = document.createElement('div'); nested.className = 'ink-v2-border-fields';
        nested.appendChild(panel.renderControl({ ...control, name: 'border-width', type: 'dimensions', label: 'Border Width', units: ['px', 'em', 'rem', 'vw'], responsive: true }, node));
        nested.appendChild(panel.renderControl({ ...control, name: 'border-color', type: 'color', label: 'Border Color' }, node));
        wrapper.appendChild(nested);
    }
    if (control.state === 'hover') {
        wrapper.appendChild(panel.renderControl({ ...control, state: 'base', name: 'border-transition-duration', type: 'slider', label: 'Transition Duration', min: 0, max: 3, step: 0.1, default: 0.3 }, node));
    }
    row.appendChild(wrapper); return row;
}

export function repeater(panel, control, node, value, row) {
    const items = Array.isArray(value) ? value : [];
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-repeater';
    const update = (next) => panel.setValue(control, node, next);
    items.forEach((item, index) => {
        const details = document.createElement('details'); details.open = index === 0;
        const summary = document.createElement('summary'); summary.innerHTML = `<span>⋮⋮</span><strong>${item[control.titleField] || item.title || `Item ${index + 1}`}</strong>`;
        const tools = document.createElement('span'); tools.className = 'ink-v2-repeater-tools';
        [['↑', -1], ['↓', 1]].forEach(([label, direction]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.disabled = index + direction < 0 || index + direction >= items.length; button.addEventListener('click', (event) => { event.preventDefault(); const next = [...items]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; update(next); }); tools.appendChild(button); });
        const duplicate = document.createElement('button'); duplicate.type = 'button'; duplicate.textContent = '⧉'; duplicate.addEventListener('click', (event) => { event.preventDefault(); const next = [...items]; next.splice(index + 1, 0, structuredClone(item)); update(next); });
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.disabled = items.length <= (control.minItems || 0); remove.addEventListener('click', (event) => { event.preventDefault(); update(items.filter((_, cursor) => cursor !== index)); }); tools.append(duplicate, remove); summary.appendChild(tools); details.appendChild(summary);
        const fields = document.createElement('div'); fields.className = 'ink-v2-repeater-fields';
        (control.fields || []).forEach((field) => {
            const label = document.createElement('label'); label.textContent = field.label || field.name; let input;
            if (field.type === 'select') { input = document.createElement('select'); (field.options || []).forEach((option) => input.add(new Option(labelFor(option), valueFor(option)))); }
            else { input = document.createElement(field.type === 'textarea' ? 'textarea' : 'input'); if (input.tagName === 'INPUT') input.type = field.type === 'number' ? 'number' : 'text'; }
            input.value = item[field.name] ?? field.default ?? ''; input.addEventListener('change', () => { const next = structuredClone(items); next[index][field.name] = field.type === 'number' ? Number(input.value) : input.value; update(next); }); label.appendChild(input); fields.appendChild(label);
        });
        details.appendChild(fields); wrapper.appendChild(details);
    });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'ink-v2-repeater-add'; add.textContent = '+ Add item'; add.disabled = !!control.maxItems && items.length >= control.maxItems;
    add.addEventListener('click', () => { const item = {}; (control.fields || []).forEach((field) => { item[field.name] = field.default ?? ''; }); update([...items, item]); }); wrapper.appendChild(add); row.appendChild(wrapper); return row;
}

/* ------------------------------------------------------------------ *
 * Surface controls (background / typography / structure / notices / wysiwyg)
 * ------------------------------------------------------------------ */

export function background(panel, control, node, value, row) {
    row.classList.add('ink-v2-control-group');
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-background';
    const overlay = control.part === 'overlay';
    const prefix = overlay ? 'overlay-' : '';
    const modeControl = { ...control, name: overlay ? '--ink-overlay-background-type' : '--ink-background-type', type: 'text' };
    const mode = panel.currentValue(modeControl, node);
    const typeRow = document.createElement('div'); typeRow.className = 'ink-v2-background-type';
    const label = document.createElement('span'); label.textContent = 'Background Type';
    const choices = document.createElement('div'); choices.className = 'ink-v2-background-choices';
    const backgroundChoices = [
        ['classic', 'brush', 'Classic'],
        ['gradient', 'gradient', 'Gradient'],
    ];
    if (!overlay && (control.state || 'base') === 'base') backgroundChoices.push(['video', 'video_library', 'Video'], ['slideshow', 'slideshow', 'Slideshow']);
    backgroundChoices.forEach(([choiceValue, iconName, title]) => {
        const button = document.createElement('button'); button.type = 'button'; button.title = title; button.setAttribute('aria-label', title); button.setAttribute('aria-pressed', mode === choiceValue ? 'true' : 'false'); button.classList.toggle('is-active', mode === choiceValue);
        button.innerHTML = `<span class="material-symbols-rounded">${iconName}</span>`;
        button.addEventListener('click', () => panel.setValue(modeControl, node, mode === choiceValue ? '' : choiceValue));
        choices.appendChild(button);
    });
    typeRow.append(label, choices); wrapper.appendChild(typeRow);
    const sub = (partial) => panel.renderControl({ tab: control.tab, target: control.target, section: control.section, state: control.state, part: control.part, ...partial }, node);
    const settingSub = (partial) => panel.renderControl({ tab: control.tab, target: 'settings', section: control.section, ...partial }, node);
    if (mode === 'classic') {
        wrapper.appendChild(sub({ name: `${prefix}background-color`, type: 'color', label: 'Color' }));
        wrapper.appendChild(sub({ name: `${prefix}background-image`, type: 'media', label: 'Image' }));
        if (panel.currentValue({ ...control, name: `${prefix}background-image` }, node)) {
            wrapper.appendChild(sub({ name: `${prefix}background-position`, type: 'select', label: 'Position', options: ['center center', 'center top', 'center bottom', 'left top', 'left center', 'left bottom', 'right top', 'right center', 'right bottom'] }));
            wrapper.appendChild(sub({ name: `${prefix}background-attachment`, type: 'select', label: 'Attachment', options: ['scroll', 'fixed', 'local'] }));
            wrapper.appendChild(sub({ name: `${prefix}background-repeat`, type: 'select', label: 'Repeat', options: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'] }));
            wrapper.appendChild(sub({ name: `${prefix}background-size`, type: 'select', label: 'Size', options: ['auto', 'cover', 'contain'] }));
        }
    } else if (mode === 'gradient') {
        wrapper.appendChild(sub({ name: `${prefix}background-image`, type: 'gradient', label: 'Gradient' }));
    } else if (!overlay && mode === 'video') {
        wrapper.appendChild(settingSub({ name: 'backgroundVideoUrl', type: 'url', label: 'Video Link', description: 'YouTube, Vimeo, or a direct MP4/WebM URL.' }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoStart', type: 'number', label: 'Start Time (seconds)', default: 0 }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoEnd', type: 'number', label: 'End Time (seconds)' }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoPlayOnce', type: 'switcher', label: 'Play Once' }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoPlayOnMobile', type: 'switcher', label: 'Play On Mobile', default: true }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoPrivacy', type: 'switcher', label: 'Privacy Mode', description: 'Uses youtube-nocookie.com for YouTube backgrounds.' }));
        wrapper.appendChild(settingSub({ name: 'backgroundVideoFallback', type: 'media', label: 'Background Fallback', accept: 'image/*' }));
    } else if (!overlay && mode === 'slideshow') {
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowImages', type: 'gallery', label: 'Images' }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowLoop', type: 'switcher', label: 'Infinite Loop', default: true }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowDuration', type: 'number', label: 'Duration (ms)', default: 5000 }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowTransition', type: 'select', label: 'Transition', default: 'fade', options: [
            { value: 'fade', label: 'Fade' }, { value: 'slide_right', label: 'Slide Right' }, { value: 'slide_left', label: 'Slide Left' }, { value: 'slide_up', label: 'Slide Up' }, { value: 'slide_down', label: 'Slide Down' },
        ] }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowTransitionDuration', type: 'number', label: 'Transition Duration (ms)', default: 500 }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowSize', type: 'select', label: 'Background Size', default: 'cover', options: ['auto', 'cover', 'contain'] }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowPosition', type: 'select', label: 'Background Position', default: 'center center', options: ['center center', 'center top', 'center bottom', 'left top', 'left center', 'left bottom', 'right top', 'right center', 'right bottom'] }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowLazyload', type: 'switcher', label: 'Lazy Load' }));
        wrapper.appendChild(settingSub({ name: 'backgroundSlideshowKenBurns', type: 'switcher', label: 'Ken Burns Effect' }));
        if (node.settings.backgroundSlideshowKenBurns) wrapper.appendChild(settingSub({ name: 'backgroundSlideshowZoomDirection', type: 'select', label: 'Zoom Direction', default: 'in', options: [{ value: 'in', label: 'In' }, { value: 'out', label: 'Out' }] }));
    }
    if (overlay && mode) {
        wrapper.appendChild(sub({ name: 'overlay-opacity', type: 'slider', label: 'Opacity', min: 0, max: 1, step: 0.01, default: 0.5, responsive: true }));
        wrapper.appendChild(sub({ name: 'overlay-filter', type: 'css-filters', label: 'CSS Filters' }));
        wrapper.appendChild(sub({ name: 'overlay-mix-blend-mode', type: 'select', label: 'Blend Mode', options: [{ value: '', label: 'Normal' }, 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'saturation', 'color', 'luminosity'] }));
    }
    if (mode && control.state === 'hover') wrapper.appendChild(sub({ name: overlay ? 'overlay-transition-duration' : 'background-transition-duration', state: 'base', type: 'slider', label: 'Transition Duration', min: 0, max: 3, step: 0.1, default: 0.3 }));
    row.appendChild(wrapper); return row;
}

export function shapeDivider(panel, control, node, value, row) {
    row.classList.add('ink-v2-control-group');
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-shape-divider';
    const side = panel.shapeDividerSides.get(node.id) || 'top';
    const tabs = document.createElement('div'); tabs.className = 'ink-v2-states'; tabs.style.setProperty('--ink-state-count', 2);
    ['top', 'bottom'].forEach((name) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = name[0].toUpperCase() + name.slice(1); button.classList.toggle('is-active', side === name);
        button.addEventListener('click', () => { panel.shapeDividerSides.set(node.id, name); panel.render(); }); tabs.appendChild(button);
    });
    wrapper.appendChild(tabs);
    const settingName = `shapeDivider${side[0].toUpperCase()}${side.slice(1)}`;
    const dividerValue = node.settings[settingName] && typeof node.settings[settingName] === 'object' ? node.settings[settingName] : {};
    const update = (patch) => panel.runtime.update(node.id, { settings: { [settingName]: { ...dividerValue, ...patch } } }, `Change ${side} shape divider`);
    const field = (labelText, input) => { const fieldRow = document.createElement('label'); fieldRow.className = 'ink-v2-shape-field'; const label = document.createElement('span'); label.textContent = labelText; fieldRow.append(label, input); wrapper.appendChild(fieldRow); return input; };
    const type = document.createElement('select'); type.add(new Option('None', '')); Object.entries(ELEMENTOR_SHAPES).forEach(([key, shape]) => type.add(new Option(shape.title, key))); type.value = dividerValue.type || ''; type.addEventListener('change', () => update({ type: type.value })); field('Type', type);
    if (dividerValue.type) {
        const shapeMeta = ELEMENTOR_SHAPES[dividerValue.type] || {};
        const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = /^#[0-9a-f]{6}$/i.test(dividerValue.color || '') ? dividerValue.color : '#ffffff'; colorInput.addEventListener('change', () => update({ color: colorInput.value })); field('Color', colorInput);
        [...(shapeMeta.heightOnly ? [] : [['Width', 'width', 100, 300, 100, '%']]), ['Height', 'height', 0, 500, 100, 'px']].forEach(([labelText, key, min, max, fallback, unit]) => {
            const group = document.createElement('div'); group.className = 'ink-v2-shape-range'; const range = document.createElement('input'); range.type = 'range'; range.min = min; range.max = max; range.value = dividerValue[key] ?? fallback; const number = document.createElement('input'); number.type = 'number'; number.min = min; number.max = max; number.value = range.value; const suffix = document.createElement('span'); suffix.textContent = unit;
            range.addEventListener('input', () => { number.value = range.value; }); const commit = (source) => { range.value = source.value; number.value = source.value; update({ [key]: Number(source.value) }); }; range.addEventListener('change', () => commit(range)); number.addEventListener('change', () => commit(number)); group.append(range, number, suffix); field(labelText, group);
        });
        [...(shapeMeta.flip ? [['Flip', 'flip']] : []), ...(shapeMeta.negative ? [['Invert', 'invert']] : []), ['Bring to Front', 'front']].forEach(([labelText, key]) => {
            const switcher = document.createElement('label'); switcher.className = 'ink-v2-switch'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!dividerValue[key]; const track = document.createElement('span'); track.dataset.on = 'Yes'; track.dataset.off = 'No'; checkbox.addEventListener('change', () => update({ [key]: checkbox.checked })); switcher.append(checkbox, track); field(labelText, switcher);
        });
    }
    row.appendChild(wrapper); return row;
}

export function typography(panel, control, node, value, row) {
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-background ink-v2-typography';
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'ink-v2-background-trigger'; trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span class="material-symbols-rounded">text_fields</span><span>Typography</span>';
    const body = document.createElement('div'); body.className = 'ink-v2-background-body';
    const sub = (partial) => panel.renderControl({ tab: control.tab, target: control.target, section: control.section, ...partial }, node);
    body.appendChild(sub({ name: 'font-family', type: 'font', label: 'Font family', options: ['inherit', 'system-ui, sans-serif', ...GOOGLE_FONTS.map((font) => font.value)] }));
    body.appendChild(sub({ name: 'font-size', type: 'size', label: 'Size', units: ['px', 'rem', 'em'], responsive: true }));
    body.appendChild(sub({ name: 'font-weight', type: 'select', label: 'Weight', options: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] }));
    body.appendChild(sub({ name: 'font-style', type: 'select', label: 'Style', options: ['normal', 'italic', 'oblique'] }));
    body.appendChild(sub({ name: 'text-transform', type: 'select', label: 'Transform', options: ['none', 'uppercase', 'lowercase', 'capitalize'] }));
    body.appendChild(sub({ name: 'text-decoration', type: 'select', label: 'Decoration', options: ['none', 'underline', 'line-through', 'overline'] }));
    body.appendChild(sub({ name: 'line-height', type: 'size', label: 'Line height', units: ['', 'px', 'em'], responsive: true }));
    body.appendChild(sub({ name: 'letter-spacing', type: 'size', label: 'Letter spacing', units: ['px', 'em'], responsive: true }));
    const toggle = () => { const open = wrapper.classList.toggle('is-open'); trigger.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    trigger.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); toggle(); });
    wrapper.append(trigger, body); row.appendChild(wrapper); return row;
}

export function structure(panel, control, node, value, row) {
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-structure';
    const grid = document.createElement('div'); grid.className = 'ink-v2-structure-grid';
    (control.options || []).forEach((option) => {
        const preset = String(valueFor(option)); const widths = preset.split(',').map(Number);
        const button = document.createElement('button'); button.type = 'button'; button.title = labelFor(option);
        const current = node.settings[control.name] || node.settings.structure;
        button.classList.toggle('is-active', String(current) === preset);
        button.setAttribute('aria-label', labelFor(option) || preset);
        button.innerHTML = `<span class="ink-v2-structure-cols">${widths.map((w) => `<i style="flex:${w}"></i>`).join('')}</span><span class="ink-v2-structure-label">${labelFor(option)}</span>`;
        button.addEventListener('click', () => { panel.applyStructure(node, preset); panel.render(); });
        grid.appendChild(button);
    });
    wrapper.appendChild(grid); row.appendChild(wrapper); return row;
}

export function popoverToggle(panel, control, node, value, row) {
    const details = document.createElement('details'); details.className = 'ink-v2-popover'; const summary = document.createElement('summary'); summary.textContent = control.text || 'Open settings'; details.appendChild(summary);
    (control.controls || []).forEach((nested) => details.appendChild(panel.renderControl({ tab: control.tab, section: control.section, target: control.target, ...nested }, node))); row.appendChild(details); return row;
}

export function notice(panel, control, node, value, row) {
    row.classList.add(`ink-v2-control-${control.type}`);
    if (control.type === 'divider') row.appendChild(document.createElement('hr'));
    else { const message = document.createElement(control.type === 'heading' ? 'h4' : 'div'); message.textContent = control.text || control.content || control.label; row.replaceChildren(message); }
    return row;
}

export function actionButton(panel, control, node, value, row) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'ink-v2-action-button'; button.textContent = control.text || control.label;
    button.addEventListener('click', () => control.onClick?.({ runtime: panel.runtime, node, control })); row.appendChild(button); return row;
}

export function hidden(panel, control, node, value, row) { row.hidden = true; return row; }

export function wysiwyg(panel, control, node, value, row) {
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-wysiwyg';
    const toolbar = document.createElement('div'); toolbar.className = 'ink-v2-wysiwyg-toolbar';
    const adapter = new RichTextAdapter();
    const commands = [
        [0, 'toggleBold', 'B', 'bold', null], [1, 'toggleItalic', 'I', 'italic', null], [2, 'toggleUnderline', 'U', 'underline', null], [3, 'toggleStrike', 'S', 'strike', null],
        [4, 'toggleBulletList', '• List', 'bulletList', null], [5, 'toggleOrderedList', '1. List', 'orderedList', null],
        [6, 'setParagraph', '¶', 'paragraph', null], [7, 'toggleHeading', 'H1', 'heading', { level: 1 }], [8, 'toggleHeading', 'H2', 'heading', { level: 2 }], [9, 'toggleHeading', 'H3', 'heading', { level: 3 }],
        [10, 'toggleBlockquote', '❝', 'blockquote', null], [11, 'toggleCodeBlock', '</>', 'codeBlock', null], [12, 'setHorizontalRule', '—', null, null],
    ];
    const refreshActive = () => {
        commands.forEach(([index, command, label, stateCommand, arg]) => {
            if (!stateCommand) return;
            const button = toolbar.querySelector(`[data-cmd="${index}"]`);
            if (button) button.classList.toggle('is-active', adapter.isActive(stateCommand));
        });
    };
    commands.forEach(([index, command, label, stateCommand, arg]) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.title = command; button.dataset.cmd = String(index);
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', (event) => {
            event.preventDefault();
            if (arg) adapter.runCommand(command, arg);
            else adapter.runCommand(command);
            refreshActive();
        });
        toolbar.appendChild(button);
    });
    const editor = document.createElement('div'); editor.className = 'ink-v2-wysiwyg-editor';
    const initial = value && typeof value === 'object' && value.json ? value.json : (typeof value === 'string' && value.startsWith('{') ? (() => { try { return JSON.parse(value); } catch (_) { return null; } })() : null);
    adapter.mount(editor, {
        content: initial || (typeof value === 'string' && !value.startsWith('{') ? value : '<p></p>'),
        onChange: (json) => panel.setValue(control, node, { json, html: adapter.getHTML() }),
    });
    wrapper.append(toolbar, editor); row.appendChild(wrapper);
    editor.addEventListener('keyup', refreshActive); editor.addEventListener('mouseup', refreshActive); editor.addEventListener('keydown', () => setTimeout(refreshActive, 0));
    return row;
}
