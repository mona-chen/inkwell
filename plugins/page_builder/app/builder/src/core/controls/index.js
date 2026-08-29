// Standalone control renderers — independent implementations with a uniform contract:
//   render(panel, control, node, value, row) => row
// PanelManager stays thin: renderControl() delegates here via the ControlRegistry.
// Each renderer uses only the panel context (setValue/currentValue/renderControl/
// runtime) — no private PanelManager state.

import { pickMedia, uploadMedia } from '../MediaPicker.js';
import { RichTextAdapter } from '../RichTextAdapter.js';
import { iconNames, iconCount, iconValue, resolveIcon, renderIcon, libraryTitle } from '../icons.js';
import { availableFonts } from '../fonts.js';
import { ELEMENTOR_SHAPES } from '../elementorShapes.js';

const labelFor = (option) => typeof option === 'object' ? option.label : String(option).replace(/-/g, ' ');
const valueFor = (option) => typeof option === 'object' ? option.value : option;

// Native inputs in custom controls must commit like the generic PanelManager inputs.
// Relying only on `change` makes typed values look accepted while Enter does nothing,
// which is especially damaging for dimensions, spacing, and URLs.
const commitOnFinish = (input, commit) => {
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || input.tagName === 'TEXTAREA') return;
        event.preventDefault();
        commit();
        input.blur();
    });
};

const switchControl = ({ checked = false, onLabel = 'Yes', offLabel = 'No', ariaLabel = '' } = {}) => {
    const wrapper = document.createElement('span'); wrapper.className = 'ink-v2-switch';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = checked;
    if (ariaLabel) checkbox.setAttribute('aria-label', ariaLabel);
    const track = document.createElement('span'); track.className = 'ink-v2-switch-track'; track.dataset.on = onLabel; track.dataset.off = offLabel; track.setAttribute('aria-hidden', 'true');
    track.addEventListener('click', () => checkbox.click());
    wrapper.append(checkbox, track);
    return { wrapper, checkbox };
};

/* ------------------------------------------------------------------ *
 * Switcher / slider / gaps / dimensions (value editors)
 * ------------------------------------------------------------------ */

export function switcher(panel, control, node, value, row) {
    const initial = (value === '' || value === undefined) && control.default !== undefined ? !!control.default : value === true || value === control.returnValue || value === 'yes';
    const { wrapper, checkbox } = switchControl({ checked: initial, onLabel: control.onLabel || 'Yes', offLabel: control.offLabel || 'No', ariaLabel: control.label });
    checkbox.addEventListener('change', () => panel.setValue(control, node, checkbox.checked ? (control.returnValue ?? true) : (control.offValue ?? false)));
    row.appendChild(wrapper); return row;
}

export function motion(panel, control, node, value, row) {
    const current = value && typeof value === 'object' ? value : {};
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-motion-control';
    const field = (labelText, input) => { const label = document.createElement('label'); label.textContent = labelText; label.appendChild(input); wrapper.appendChild(label); return input; };
    const enabledControl = switchControl({ checked: !!value && current.enabled !== false, ariaLabel: 'Animation enabled' }); const enabled = enabledControl.checkbox;
    const trigger = document.createElement('select'); ['load', 'hover'].forEach((name) => trigger.add(new Option(name, name))); trigger.value = current.trigger || 'load';
    const duration = document.createElement('input'); duration.type = 'number'; duration.min = '1'; duration.step = '50'; duration.value = current.duration || 800;
    const delay = document.createElement('input'); delay.type = 'number'; delay.step = '50'; delay.value = current.delay || 0;
    const easing = document.createElement('select'); ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(.16,1,.3,1)'].forEach((name) => easing.add(new Option(name, name))); easing.value = current.easing || 'ease';
    const iterations = document.createElement('input'); iterations.type = 'text'; iterations.value = current.iterations ?? 1; iterations.placeholder = '1 or infinite';
    const direction = document.createElement('select'); ['normal', 'reverse', 'alternate', 'alternate-reverse'].forEach((name) => direction.add(new Option(name, name))); direction.value = current.direction || 'normal';
    const keyframes = document.createElement('textarea'); keyframes.className = 'ink-v2-code'; keyframes.rows = 8; keyframes.spellcheck = false; keyframes.value = JSON.stringify(current.keyframes || [{ offset: 0, opacity: 0, transform: 'translateY(24px)' }, { offset: 1, opacity: 1, transform: 'translateY(0)' }], null, 2);
    field('Enabled', enabledControl.wrapper); field('Trigger', trigger); field('Duration (ms)', duration); field('Delay (ms)', delay); field('Easing', easing); field('Iterations', iterations); field('Direction', direction); field('Keyframes', keyframes);
    const status = document.createElement('small'); status.className = 'ink-v2-control-description'; wrapper.appendChild(status);
    const commit = () => {
        let parsed;
        try { parsed = JSON.parse(keyframes.value); if (!Array.isArray(parsed) || parsed.length < 2) throw new Error('Use at least two keyframes'); }
        catch (error) { status.textContent = error.message; keyframes.setAttribute('aria-invalid', 'true'); return; }
        keyframes.removeAttribute('aria-invalid'); status.textContent = '';
        panel.setValue(control, node, { enabled: enabled.checked, trigger: trigger.value, duration: Math.max(1, Number(duration.value) || 800), delay: Number(delay.value) || 0, easing: easing.value, iterations: iterations.value === 'infinite' ? 'infinite' : Math.max(1, Number(iterations.value) || 1), direction: direction.value, keyframes: parsed });
    };
    [enabled, trigger, duration, delay, easing, iterations, direction, keyframes].forEach((input) => input.addEventListener('change', commit));
    row.appendChild(wrapper); return row;
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

const flowSvg = (mode) => {
    const common = 'viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"';
    if (mode === 'vertical') return `<svg ${common}><rect x="3" y="2" width="4" height="4" rx=".75"/><rect x="9" y="2" width="4" height="4" rx=".75"/><path d="M8 8v5m0 0-2-2m2 2 2-2"/></svg>`;
    if (mode === 'horizontal') return `<svg ${common}><rect x="2" y="3" width="4" height="4" rx=".75"/><rect x="2" y="9" width="4" height="4" rx=".75"/><path d="M8 8h5m0 0-2-2m2 2-2 2"/></svg>`;
    if (mode === 'grid') return `<svg ${common}><rect x="2" y="2" width="4" height="4" rx=".75"/><rect x="10" y="2" width="4" height="4" rx=".75"/><rect x="2" y="10" width="4" height="4" rx=".75"/><rect x="10" y="10" width="4" height="4" rx=".75"/></svg>`;
    return `<svg ${common}><rect x="2" y="2" width="4" height="4" rx=".75"/><rect x="10" y="3" width="4" height="4" rx=".75"/><rect x="5" y="10" width="4" height="4" rx=".75"/></svg>`;
};

const layoutStyleControl = (control, name) => ({ ...control, type: 'text', target: 'styles', name, state: 'base' });

export function layoutFlow(panel, control, node, _value, row) {
    row.classList.add('ink-v2-layout-flow-control');
    const displayControl = layoutStyleControl(control, 'display');
    const directionControl = layoutStyleControl(control, 'flex-direction');
    const display = panel.currentValue(displayControl, node) || 'flex';
    const direction = panel.currentValue(directionControl, node) || 'column';
    const active = display === 'grid' ? 'grid' : display === 'block' ? 'free' : direction.startsWith('row') ? 'horizontal' : 'vertical';
    const host = document.createElement('div'); host.className = 'ink-v2-layout-flow-host';
    const choices = document.createElement('div'); choices.className = 'ink-v2-layout-flow'; choices.setAttribute('role', 'radiogroup'); choices.setAttribute('aria-label', 'Layout flow');
    [['free', 'Freeform'], ['vertical', 'Vertical'], ['horizontal', 'Horizontal'], ['grid', 'Grid']].forEach(([mode, label]) => {
        const button = document.createElement('button'); button.type = 'button'; button.title = label; button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', active === mode ? 'true' : 'false'); button.classList.toggle('is-active', active === mode); button.innerHTML = flowSvg(mode);
        button.addEventListener('click', () => {
            panel.runtime.history.begin(`Change flow to ${label}`);
            if (mode === 'grid') panel.setValue(displayControl, node, 'grid');
            else if (mode === 'free') panel.setValue(displayControl, node, 'block');
            else {
                panel.setValue(displayControl, node, 'flex');
                panel.setValue(directionControl, node, mode === 'horizontal' ? 'row' : 'column');
            }
            panel.runtime.history.commit();
        });
        choices.appendChild(button);
    });
    const reverse = document.createElement('button'); reverse.type = 'button'; reverse.className = 'ink-v2-flow-reverse'; reverse.title = 'Reverse flow'; reverse.setAttribute('aria-label', reverse.title); reverse.setAttribute('aria-pressed', /-reverse$/.test(direction) ? 'true' : 'false'); reverse.classList.toggle('is-active', /-reverse$/.test(direction)); reverse.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 5H5.5a3.5 3.5 0 0 0 0 7H11m2-7-2-2m2 2-2 2"/></svg>';
    reverse.disabled = display !== 'flex';
    reverse.addEventListener('click', () => panel.setValue(directionControl, node, /-reverse$/.test(direction) ? direction.replace('-reverse', '') : `${direction}-reverse`));
    host.append(choices, reverse); row.appendChild(host); return row;
}

const sizingMode = (raw, property, unit = '') => raw === 'fit-content' || raw === 'max-content' || (!raw && property === 'height') ? 'hug' : raw === '100%' ? 'fill' : unit && unit !== 'px' ? 'relative' : 'fixed';

const renderResizingFields = (panel, control, node) => {
    const c = (name) => layoutStyleControl(control, name);
    const sizing = document.createElement('div'); sizing.className = 'ink-v2-resizing';
    const menus = [];
    const renderAxis = (axis, property) => {
        const current = panel.currentValue(c(property), node);
        const raw = current && typeof current === 'object' ? current.size : current;
        const currentUnit = current && typeof current === 'object' ? current.unit || 'px' : typeof current === 'string' && /%$/.test(current) ? '%' : 'px';
        const inferred = sizingMode(raw, property, currentUnit);
        const field = document.createElement('div'); field.className = 'ink-v2-resize-field';
        const prefix = document.createElement('span'); prefix.textContent = axis;
        const number = document.createElement('input'); number.type = 'number'; number.value = ['fixed', 'relative'].includes(inferred) ? parseFloat(raw) || '' : ''; number.hidden = !['fixed', 'relative'].includes(inferred); number.setAttribute('aria-label', `${axis === 'W' ? 'Width' : 'Height'} value`);
        const unit = document.createElement('select'); (property === 'width' ? ['px', '%', 'vw', 'rem'] : ['px', '%', 'vh', 'rem']).forEach((name) => unit.add(new Option(name, name))); unit.value = currentUnit; unit.hidden = !['fixed', 'relative'].includes(inferred); unit.setAttribute('aria-label', `${axis === 'W' ? 'Width' : 'Height'} unit`);
        const mode = document.createElement('button'); mode.type = 'button'; mode.textContent = inferred === 'fixed' ? 'Fixed' : inferred === 'relative' ? 'Relative' : inferred === 'fill' ? 'Fill' : 'Hug'; mode.title = `${axis === 'W' ? 'Width' : 'Height'} resizing`; mode.setAttribute('aria-label', mode.title);
        const menu = document.createElement('div'); menu.className = 'ink-v2-resize-menu'; menu.hidden = true;
        [['fixed', 'Fixed'], ['relative', 'Relative'], ['hug', 'Hug contents'], ['fill', 'Fill container']].forEach(([nextMode, label]) => {
            const option = document.createElement('button'); option.type = 'button'; option.dataset.mode = nextMode; option.classList.toggle('is-active', inferred === nextMode); option.innerHTML = `<span>${inferred === nextMode ? '✓' : ''}</span>${label}`;
            option.addEventListener('click', () => {
                panel.runtime.history.begin(`Set ${property} to ${label}`);
                if (nextMode === 'hug') {
                    panel.setValue(c(property), node, 'fit-content');
                    if (property === 'width') panel.setValue(c('flex-grow'), node, 0);
                } else if (nextMode === 'fill') {
                    panel.setValue(c(property), node, '100%');
                    if (property === 'width') panel.setValue(c('flex-grow'), node, 1);
                } else if (nextMode === 'relative') {
                    panel.setValue(c(property), node, { size: Number(number.value) || 100, unit: '%' });
                    if (property === 'width') panel.setValue(c('flex-grow'), node, 0);
                } else {
                    panel.setValue(c(property), node, { size: Number(number.value) || (property === 'width' ? 320 : 200), unit: 'px' });
                    if (property === 'width') panel.setValue(c('flex-grow'), node, 0);
                }
                panel.runtime.history.commit();
            });
            menu.appendChild(option);
        });
        const limits = document.createElement('div'); limits.className = 'ink-v2-resize-limits';
        [['min', `Min ${property}`], ['max', `Max ${property}`]].forEach(([kind, label]) => {
            const limit = document.createElement('label'); limit.append(label);
            const input = document.createElement('input'); input.type = 'number';
            const limitControl = c(`${kind}-${property}`); const value = panel.currentValue(limitControl, node);
            input.value = value && typeof value === 'object' ? value.size ?? '' : parseFloat(value) || '';
            commitOnFinish(input, () => panel.setValue(limitControl, node, input.value === '' ? '' : { size: Number(input.value), unit: 'px' }));
            limit.appendChild(input); limits.appendChild(limit);
        });
        menu.appendChild(limits); menus.push([menu, mode]);
        mode.addEventListener('click', () => { const opening = menu.hidden; menus.forEach(([other, trigger]) => { other.hidden = true; trigger.classList.remove('is-active'); }); menu.hidden = !opening; mode.classList.toggle('is-active', opening); });
        const commit = () => panel.setValue(c(property), node, { size: Number(number.value) || 0, unit: unit.value });
        commitOnFinish(number, commit); unit.addEventListener('change', commit);
        field.append(prefix, number, unit, mode, menu); return field;
    };
    sizing.append(renderAxis('W', 'width'), renderAxis('H', 'height'));
    return sizing;
};

// Fixed/Hug/Fill is a universal element capability, not a container-only layout option.
export function resizing(panel, control, node, _value, row) {
    row.classList.add('ink-v2-resizing-control');
    row.appendChild(renderResizingFields(panel, control, node));
    return row;
}

// Parent-relative positioning with explicit pins. A blank inset means that edge is not
// constrained; this maps cleanly to responsive CSS while retaining design-tool intent.
export function positioning(panel, control, node, _value, row) {
    row.classList.add('ink-v2-positioning-control');
    const c = (name) => layoutStyleControl(control, name);
    const host = document.createElement('div'); host.className = 'ink-v2-positioning';
    const current = panel.currentValue(c('position'), node) || 'static';
    const flowValue = panel.runtime.elements.get(node.type).acceptsChildren ? 'relative' : 'static';
    const activeMode = current === 'static' || current === 'relative' ? 'flow' : current;
    const modes = document.createElement('div'); modes.className = 'ink-v2-position-modes'; modes.setAttribute('role', 'radiogroup'); modes.setAttribute('aria-label', 'Position mode');
    [['flow', 'Flow', flowValue], ['absolute', 'Absolute', 'absolute'], ['fixed', 'Fixed', 'fixed'], ['sticky', 'Sticky', 'sticky']].forEach(([mode, label, value]) => {
        const selected = activeMode === mode;
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.classList.toggle('is-active', selected); button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', selected ? 'true' : 'false');
        button.addEventListener('click', () => panel.setValue(c('position'), node, value)); modes.appendChild(button);
    });
    host.appendChild(modes);
    if (current !== 'static') {
        const pins = document.createElement('div'); pins.className = 'ink-v2-position-pins';
        ['top', 'right', 'bottom', 'left'].forEach((side) => {
            const pinControl = c(side); const existing = panel.currentValue(pinControl, node); const raw = existing && typeof existing === 'object' ? existing.size : existing;
            const field = document.createElement('label'); field.dataset.side = side; field.append(side[0].toUpperCase());
            const input = document.createElement('input'); input.type = 'number'; input.value = raw === '' || raw === undefined || raw === null ? '' : parseFloat(raw); input.placeholder = '—'; input.setAttribute('aria-label', `${side} pin`);
            const unit = document.createElement('select'); ['px', '%', 'rem', side === 'top' || side === 'bottom' ? 'vh' : 'vw'].forEach((name) => unit.add(new Option(name, name))); unit.value = existing?.unit || 'px';
            const commit = () => panel.setValue(pinControl, node, input.value === '' ? '' : { size: Number(input.value), unit: unit.value });
            commitOnFinish(input, commit); unit.addEventListener('change', commit); field.append(input, unit); pins.appendChild(field);
        });
        host.appendChild(pins);
    }
    row.appendChild(host); return row;
}

export function alignmentGap(panel, control, node, _value, row) {
    row.classList.add('ink-v2-alignment-gap-control');
    const c = (name) => layoutStyleControl(control, name);
    const read = (name, fallback = '') => panel.currentValue(c(name), node) || fallback;
    const display = read('display', 'flex'); const direction = read('flex-direction', 'column');
    const justify = read('justify-content', 'flex-start'); const align = read('align-items', 'stretch');
    const gap = panel.currentValue(c('gap'), node); const gaps = gap && typeof gap === 'object' ? gap : { row: 0, column: 0, unit: 'px', linked: true };
    const paddingValue = panel.currentValue(c('padding'), node); const padding = paddingValue && typeof paddingValue === 'object' ? paddingValue : { top: 0, right: 0, bottom: 0, left: 0, unit: 'px', linked: false };
    const host = document.createElement('div'); host.className = `ink-v2-auto-layout is-${display === 'grid' ? 'grid' : display === 'block' ? 'free' : direction.startsWith('row') ? 'horizontal' : 'vertical'}`;
    const sizingLabel = document.createElement('span'); sizingLabel.className = 'ink-v2-auto-layout-label'; sizingLabel.textContent = 'Resizing'; host.appendChild(sizingLabel);
    host.appendChild(renderResizingFields(panel, control, node));
    const top = document.createElement('div'); top.className = 'ink-v2-auto-layout-grid';
    const alignmentField = document.createElement('div'); alignmentField.className = 'ink-v2-auto-layout-field'; alignmentField.innerHTML = '<span>Alignment</span>';
    const alignment = document.createElement('div'); alignment.className = 'ink-v2-alignment-grid'; alignment.setAttribute('role', 'radiogroup'); alignment.setAttribute('aria-label', 'Content alignment');
    const normalize = (value) => value === 'flex-start' || value === 'start' ? 'start' : value === 'flex-end' || value === 'end' ? 'end' : value === 'center' ? 'center' : '';
    const horizontalValue = (direction.startsWith('row') ? normalize(justify) : normalize(align)) || 'start';
    const verticalValue = (direction.startsWith('row') ? normalize(align) : normalize(justify)) || 'start';
    ['start', 'center', 'end'].forEach((vertical) => ['start', 'center', 'end'].forEach((horizontal) => {
        const selected = horizontalValue === horizontal && verticalValue === vertical;
        const button = document.createElement('button'); button.type = 'button'; button.title = `${vertical} ${horizontal}`; button.setAttribute('aria-label', `${vertical} ${horizontal}`); button.setAttribute('aria-pressed', selected ? 'true' : 'false'); button.classList.toggle('is-active', selected);
        const mark = document.createElement('span'); mark.className = 'ink-v2-alignment-mark'; const markCount = selected ? (display === 'grid' ? 4 : 3) : 1; for (let index = 0; index < markCount; index += 1) mark.appendChild(document.createElement('i')); button.appendChild(mark);
        button.addEventListener('click', () => {
            const css = (value) => value === 'start' ? 'flex-start' : value === 'end' ? 'flex-end' : 'center';
            panel.runtime.history.begin('Change content alignment');
            panel.setValue(c(direction.startsWith('row') ? 'justify-content' : 'align-items'), node, css(horizontal));
            panel.setValue(c(direction.startsWith('row') ? 'align-items' : 'justify-content'), node, css(vertical));
            panel.runtime.history.commit();
        });
        alignment.appendChild(button);
    }));
    alignmentField.appendChild(alignment);

    const gapField = document.createElement('div'); gapField.className = 'ink-v2-auto-layout-field'; gapField.innerHTML = '<span>Gap</span>';
    const gapLine = document.createElement('div'); gapLine.className = 'ink-v2-gap-line';
    const gapInput = document.createElement('label'); gapInput.className = 'ink-v2-compact-number'; gapInput.innerHTML = direction.startsWith('row') ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3v10M13 3v10M6 5v6m4-6v6"/></svg>' : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h10M3 13h10M5 6h6m-6 4h6"/></svg>';
    const gapNumber = document.createElement('input'); gapNumber.type = 'number'; gapNumber.value = gaps.linked !== false && Number(gaps.row) === Number(gaps.column) ? gaps.row ?? 0 : gaps.row ?? 0; gapInput.appendChild(gapNumber);
    const settings = document.createElement('button'); settings.type = 'button'; settings.className = 'ink-v2-auto-layout-settings'; settings.title = 'Auto layout settings'; settings.setAttribute('aria-label', settings.title); settings.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12M12 2v12M2 5h4M10 11h4"/></svg>';
    gapLine.append(gapInput, settings); gapField.appendChild(gapLine);
    top.append(alignmentField, gapField); host.appendChild(top);

    const paddingHeader = document.createElement('span'); paddingHeader.className = 'ink-v2-auto-layout-label'; paddingHeader.textContent = 'Padding'; host.appendChild(paddingHeader);
    const paddingLine = document.createElement('div'); paddingLine.className = 'ink-v2-padding-line';
    const pairedInput = (axis, icon, initial) => { const label = document.createElement('label'); label.className = 'ink-v2-compact-number'; label.innerHTML = icon; const input = document.createElement('input'); input.type = 'number'; input.value = initial; input.dataset.axis = axis; label.appendChild(input); return label; };
    const horizontal = pairedInput('horizontal', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3v10M14 3v10M5 5v6m6-6v6"/></svg>', Number(padding.left) === Number(padding.right) ? padding.left ?? 0 : padding.left ?? 0);
    const vertical = pairedInput('vertical', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h10M3 14h10M5 5h6M5 11h6"/></svg>', Number(padding.top) === Number(padding.bottom) ? padding.top ?? 0 : padding.top ?? 0);
    const individual = document.createElement('button'); individual.type = 'button'; individual.className = 'ink-v2-auto-layout-settings'; individual.title = 'Individual padding'; individual.setAttribute('aria-label', individual.title); individual.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2h4v4H2zM10 2h4v4h-4zM2 10h4v4H2zM10 10h4v4h-4z"/></svg>';
    paddingLine.append(horizontal, vertical, individual); host.appendChild(paddingLine);

    const clip = document.createElement('label'); clip.className = 'ink-v2-clip-content'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = read('overflow') === 'hidden'; clip.append(checkbox, document.createTextNode('Clip content')); host.appendChild(clip);
    const commitGap = () => panel.setValue(c('gap'), node, { row: Number(gapNumber.value) || 0, column: Number(gapNumber.value) || 0, unit: gaps.unit || 'px', linked: true });
    const commitPadding = () => { const x = Number(horizontal.querySelector('input').value) || 0; const y = Number(vertical.querySelector('input').value) || 0; panel.setValue(c('padding'), node, { top: y, right: x, bottom: y, left: x, unit: padding.unit || 'px', linked: false }); };
    commitOnFinish(gapNumber, commitGap); commitOnFinish(horizontal.querySelector('input'), commitPadding); commitOnFinish(vertical.querySelector('input'), commitPadding); checkbox.addEventListener('change', () => panel.setValue(c('overflow'), node, checkbox.checked ? 'hidden' : 'visible'));
    const popover = document.createElement('div'); popover.className = 'ink-v2-auto-layout-popover'; popover.hidden = true;
    const popInput = (parent, labelText, value) => { const label = document.createElement('label'); label.append(labelText); const input = document.createElement('input'); input.type = 'number'; input.value = value ?? 0; label.appendChild(input); parent.appendChild(label); return input; };
    const rowGap = popInput(popover, 'Row gap', gaps.row); const columnGap = popInput(popover, 'Column gap', gaps.column); const unit = document.createElement('select'); (control.units || ['px', '%', 'em', 'rem', 'vw']).forEach((name) => unit.add(new Option(name, name))); unit.value = gaps.unit || 'px'; const distribution = document.createElement('select'); [['Packed', 'flex-start'], ['Center', 'center'], ['Space between', 'space-between'], ['Space around', 'space-around'], ['Space evenly', 'space-evenly']].forEach(([label, value]) => distribution.add(new Option(label, value))); distribution.value = justify; const wrap = document.createElement('label'); const wrapCheck = document.createElement('input'); wrapCheck.type = 'checkbox'; wrapCheck.checked = read('flex-wrap', 'nowrap') !== 'nowrap'; wrap.append(wrapCheck, document.createTextNode(' Wrap children')); popover.append(unit, distribution, wrap); host.appendChild(popover);
    const paddingPopover = document.createElement('div'); paddingPopover.className = 'ink-v2-auto-layout-popover is-padding'; paddingPopover.hidden = true;
    const paddingTop = popInput(paddingPopover, 'Top', padding.top); const paddingRight = popInput(paddingPopover, 'Right', padding.right); const paddingBottom = popInput(paddingPopover, 'Bottom', padding.bottom); const paddingLeft = popInput(paddingPopover, 'Left', padding.left);
    const paddingUnit = document.createElement('select'); (control.units || ['px', '%', 'em', 'rem', 'vw']).forEach((name) => paddingUnit.add(new Option(name, name))); paddingUnit.value = padding.unit || 'px'; paddingUnit.setAttribute('aria-label', 'Padding unit'); paddingPopover.appendChild(paddingUnit); host.appendChild(paddingPopover);
    const closePopovers = (except) => { [[popover, settings], [paddingPopover, individual]].forEach(([menu, button]) => { if (menu !== except) { menu.hidden = true; button.classList.remove('is-active'); } }); };
    const toggle = (menu, button) => { const opening = menu.hidden; closePopovers(opening ? menu : null); menu.hidden = !opening; button.classList.toggle('is-active', opening); };
    settings.addEventListener('click', () => toggle(popover, settings)); individual.addEventListener('click', () => toggle(paddingPopover, individual));
    const commitAdvanced = () => { panel.runtime.history.begin('Change auto layout settings'); panel.setValue(c('gap'), node, { row: Number(rowGap.value) || 0, column: Number(columnGap.value) || 0, unit: unit.value, linked: false }); panel.setValue(c('justify-content'), node, distribution.value); panel.setValue(c('flex-wrap'), node, wrapCheck.checked ? 'wrap' : 'nowrap'); panel.runtime.history.commit(); };
    [rowGap, columnGap, unit, distribution, wrapCheck].forEach((input) => input.addEventListener('change', commitAdvanced));
    const commitIndividualPadding = () => panel.setValue(c('padding'), node, { top: Number(paddingTop.value) || 0, right: Number(paddingRight.value) || 0, bottom: Number(paddingBottom.value) || 0, left: Number(paddingLeft.value) || 0, unit: paddingUnit.value, linked: false });
    [paddingTop, paddingRight, paddingBottom, paddingLeft, paddingUnit].forEach((input) => input.addEventListener('change', commitIndividualPadding));
    row.appendChild(host); return row;
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

// Exact palette observed in the reference Figma file's "On this page" set.
const INK_COLOR_PALETTE = ['#64748B', '#FFFFFF', '#3B001B', '#FEFAE7', '#FFE878', '#C0ECBF', '#FF5A1F', '#0D1B2A', '#0A1128', '#1E293B', '#F8FAFC', '#E2E8F0', '#10B981', '#94A3B8', '#A855F7', '#5FFFCF', '#060A13', '#FFBD2E', '#FF5F56', '#27C93F', '#000000', '#F4F6F9', '#1E1E1E', '#1B263B'];
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const colorChannels = (source) => {
    const text = String(source || '').trim();
    const rgba = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/i.exec(text);
    if (rgba) return { r: clamp(rgba[1], 0, 255), g: clamp(rgba[2], 0, 255), b: clamp(rgba[3], 0, 255), a: clamp(rgba[4] === undefined ? 1 : rgba[4]) };
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
    if (hex) { let body = hex[1]; if (body.length === 3) body = [...body].map((char) => char + char).join(''); return { r: parseInt(body.slice(0, 2), 16), g: parseInt(body.slice(2, 4), 16), b: parseInt(body.slice(4, 6), 16), a: body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1 }; }
    return { r: 0, g: 0, b: 0, a: 1 };
};
const colorHex = ({ r, g, b }) => `#${[r, g, b].map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
const colorCss = (rgba) => rgba.a >= 0.999 ? colorHex(rgba) : `rgba(${Math.round(rgba.r)},${Math.round(rgba.g)},${Math.round(rgba.b)},${Number(rgba.a.toFixed(2))})`;
const projectPalette = (panel, selectedNode) => {
    const found = []; const seen = new Set();
    const add = (source) => {
        const text = String(source || '').trim();
        if (!/^(#[0-9a-f]{3,8}|rgba?\()/i.test(text)) return;
        const normalized = colorCss(colorChannels(text)); const key = normalized.toLowerCase();
        if (!seen.has(key)) { seen.add(key); found.push(normalized); }
    };
    const scan = (value) => {
        if (value === null || value === undefined) return;
        if (Array.isArray(value)) { value.forEach(scan); return; }
        if (typeof value === 'object') { Object.values(value).forEach(scan); return; }
        if (typeof value !== 'string') return;
        (value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || []).forEach(add);
    };
    // Selection colors lead, followed by the complete editable document and custom code.
    scan(selectedNode); scan(panel.runtime.document.data);
    const instances = panel.runtime.canvas?.instances;
    const selectedInstance = selectedNode && instances?.get(selectedNode.id);
    const ordered = [selectedInstance, ...[...(instances?.values?.() || [])]].filter(Boolean);
    ordered.slice(0, 80).forEach((instance) => {
        const element = instance.element; if (!element?.isConnected) return;
        const view = element.ownerDocument.defaultView;
        [element, ...element.querySelectorAll('*')].slice(0, 40).forEach((item) => {
            const style = view.getComputedStyle(item);
            ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'textDecorationColor'].forEach((name) => add(style[name]));
        });
    });
    return found;
};
const rgbToHsv = ({ r, g, b }) => { const rr = r / 255; const gg = g / 255; const bb = b / 255; const max = Math.max(rr, gg, bb); const min = Math.min(rr, gg, bb); const d = max - min; let h = 0; if (d) h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4; return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }; };
const hsvToRgb = ({ h, s, v, a = 1 }) => { const c = v * s; const x = c * (1 - Math.abs((h / 60) % 2 - 1)); const m = v - c; const parts = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return { r: (parts[0] + m) * 255, g: (parts[1] + m) * 255, b: (parts[2] + m) * 255, a }; };

function openColorStudio(anchor, source, onCommit, palette = INK_COLOR_PALETTE) {
    document.querySelector('.ink-v2-color-studio')?.remove();
    let rgba = colorChannels(source); let hsv = { ...rgbToHsv(rgba), a: rgba.a };
    const studio = document.createElement('div'); studio.className = 'ink-v2-color-studio'; studio.setAttribute('role', 'dialog'); studio.setAttribute('aria-label', 'Ink color studio');
    studio.innerHTML = '<div class="ink-v2-color-studio-head"><strong>Custom</strong><span>Libraries</span><button type="button" data-eyedropper aria-label="Pick a color from the page" title="Eyedropper">⌁</button><button type="button" data-close aria-label="Close color studio">×</button></div><div class="ink-v2-color-plane"><i></i></div><input class="ink-v2-hue" type="range" min="0" max="360" step="1" aria-label="Hue"><input class="ink-v2-alpha" type="range" min="0" max="100" step="1" aria-label="Opacity"><div class="ink-v2-color-fields"><select aria-label="Color format"><option>Hex</option><option>RGBA</option></select><input data-hex aria-label="Hex color"><input data-alpha type="number" min="0" max="100" aria-label="Opacity percent"><span>%</span></div><label class="ink-v2-palette-label">On this page</label><div class="ink-v2-color-palette"></div>';
    const plane = studio.querySelector('.ink-v2-color-plane'); const indicator = plane.querySelector('i'); const hue = studio.querySelector('.ink-v2-hue'); const alpha = studio.querySelector('.ink-v2-alpha'); const hex = studio.querySelector('[data-hex]'); const alphaNumber = studio.querySelector('[data-alpha]');
    const sync = () => { rgba = hsvToRgb(hsv); const hexValue = colorHex(rgba).slice(1).toUpperCase(); plane.style.setProperty('--ink-picker-hue', `hsl(${hsv.h} 100% 50%)`); indicator.style.left = `${hsv.s * 100}%`; indicator.style.top = `${(1 - hsv.v) * 100}%`; indicator.style.setProperty('--ink-picker-color', colorCss(rgba)); hue.value = hsv.h; alpha.value = hsv.a * 100; alpha.style.setProperty('--ink-alpha-color', colorHex(rgba)); hex.value = hexValue; alphaNumber.value = Math.round(hsv.a * 100); anchor.style.setProperty('--ink-current-color', colorCss(rgba)); };
    const outside = (event) => {
        if (!studio.contains(event.target) && !anchor.contains(event.target)) {
            document.removeEventListener('pointerdown', outside);
            studio.remove();
        }
    };
    const finish = () => { document.removeEventListener('pointerdown', outside); onCommit(colorCss(rgba)); studio.remove(); };
    const setPlane = (event) => { const rect = plane.getBoundingClientRect(); hsv.s = clamp((event.clientX - rect.left) / rect.width); hsv.v = 1 - clamp((event.clientY - rect.top) / rect.height); sync(); };
    plane.addEventListener('pointerdown', (event) => { plane.setPointerCapture(event.pointerId); setPlane(event); const move = (next) => setPlane(next); const up = () => { plane.removeEventListener('pointermove', move); finish(); }; plane.addEventListener('pointermove', move); plane.addEventListener('pointerup', up, { once: true }); });
    hue.addEventListener('input', () => { hsv.h = Number(hue.value); sync(); }); hue.addEventListener('change', finish);
    alpha.addEventListener('input', () => { hsv.a = Number(alpha.value) / 100; sync(); }); alpha.addEventListener('change', finish);
    hex.addEventListener('change', () => { const next = colorChannels(`#${hex.value.replace('#', '')}`); hsv = { ...rgbToHsv(next), a: Number(alphaNumber.value) / 100 }; sync(); finish(); });
    alphaNumber.addEventListener('change', () => { hsv.a = Number(alphaNumber.value) / 100; sync(); finish(); });
    const paletteHost = studio.querySelector('.ink-v2-color-palette'); [...new Set(palette)].forEach((item) => { const swatch = document.createElement('button'); swatch.type = 'button'; swatch.title = item; swatch.setAttribute('aria-label', `Use ${item}`); swatch.style.setProperty('--swatch', item); swatch.addEventListener('click', () => { rgba = colorChannels(item); hsv = { ...rgbToHsv(rgba), a: rgba.a }; sync(); finish(); }); paletteHost.appendChild(swatch); });
    const eyeDropper = studio.querySelector('[data-eyedropper]'); eyeDropper.hidden = !window.EyeDropper;
    eyeDropper.addEventListener('click', async () => { try { const result = await new window.EyeDropper().open(); rgba = colorChannels(result.sRGBHex); hsv = { ...rgbToHsv(rgba), a: hsv.a }; sync(); finish(); } catch (_) { /* User cancelled the native picker. */ } });
    studio.querySelector('[data-close]').addEventListener('click', () => { document.removeEventListener('pointerdown', outside); studio.remove(); });
    document.body.appendChild(studio); const rect = anchor.getBoundingClientRect(); const width = studio.offsetWidth; studio.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, rect.right - width))}px`; studio.style.top = `${Math.max(8, Math.min(innerHeight - studio.offsetHeight - 8, rect.bottom + 8))}px`; sync();
    setTimeout(() => document.addEventListener('pointerdown', outside), 0);
}

function colorTrigger(source, onCommit, palette) {
    const rgba = colorChannels(source); const button = document.createElement('button'); button.type = 'button'; button.className = 'ink-v2-color-trigger'; button.style.setProperty('--ink-current-color', colorCss(rgba)); button.innerHTML = `<span></span><code>${colorHex(rgba).slice(1).toUpperCase()}</code><em>${Math.round(rgba.a * 100)}%</em>`; button.addEventListener('click', () => openColorStudio(button, colorCss(rgba), onCommit, palette)); return button;
}

export function color(panel, control, node, value, row) {
    const globals = panel.runtime.document.data.settings.theme?.colors || {};
    const resolved = /^var\(--ink-color-([^)]+)\)$/.exec(String(value || ''));
    const current = resolved ? globals[resolved[1]] || '#000000' : value || '#000000';
    const palette = [...projectPalette(panel, node), ...Object.values(globals), ...INK_COLOR_PALETTE];
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-color-control'; wrapper.appendChild(colorTrigger(current, (next) => panel.setValue(control, node, next), palette)); row.appendChild(wrapper); return row;
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
    const width = document.createElement('input'); width.type = 'number'; width.min = 0; width.value = stroke.strokeWidth ?? 0; let strokeColor = stroke.color || '#000000';
    const globals = panel.runtime.document.data.settings.theme?.colors || {};
    const commit = () => panel.setValue(control, node, { strokeWidth: Number(width.value) || 0, unit: 'px', color: strokeColor });
    const trigger = colorTrigger(strokeColor, (next) => { strokeColor = next; commit(); }, [...projectPalette(panel, node), ...Object.values(globals), ...INK_COLOR_PALETTE]); width.addEventListener('change', commit); wrapper.append(width, trigger); row.appendChild(wrapper); return row;
}

export function gradient(panel, control, node, value, row) {
    const split = (source) => { const parts = []; let depth = 0; let start = 0; [...source].forEach((char, index) => { if (char === '(') depth += 1; if (char === ')') depth -= 1; if (char === ',' && depth === 0) { parts.push(source.slice(start, index).trim()); start = index + 1; } }); parts.push(source.slice(start).trim()); return parts.filter(Boolean); };
    const color = (source) => { const channels = colorChannels(source); return { hex: colorHex(channels), alpha: Math.round(channels.a * 100) }; };
    const parsed = (() => {
        const match = /^linear-gradient\((.*)\)$/i.exec(String(value || '').trim());
        if (!match) return { angle: 90, stops: [{ color: '#6ec1e4', alpha: 100, position: 0 }, { color: '#4054b2', alpha: 100, position: 100 }] };
        const parts = split(match[1]); const anglePart = /^(-?\d+(?:\.\d+)?)deg$/i.exec(parts[0]);
        const stopParts = anglePart ? parts.slice(1) : parts; const count = Math.max(1, stopParts.length - 1);
        return { angle: anglePart ? Number(anglePart[1]) : 90, stops: stopParts.map((part, index) => { const position = /\s+(-?\d+(?:\.\d+)?)%\s*$/.exec(part); const rawColor = position ? part.slice(0, position.index).trim() : part; const parsedColor = color(rawColor); return { color: parsedColor.hex, alpha: parsedColor.alpha, position: position ? Number(position[1]) : Math.round(index / count * 100) }; }) };
    })();
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-gradient';
    const globals = panel.runtime.document.data.settings.theme?.colors || {};
    const palette = [...projectPalette(panel, node), ...Object.values(globals), ...INK_COLOR_PALETTE];
    const toolbar = document.createElement('div'); toolbar.className = 'ink-v2-gradient-toolbar';
    const kind = document.createElement('select'); kind.setAttribute('aria-label', 'Gradient type'); kind.add(new Option('Linear', 'linear')); kind.value = 'linear';
    const angleRow = document.createElement('label'); angleRow.className = 'ink-v2-gradient-angle'; angleRow.title = 'Gradient angle'; angleRow.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M7 4h5v5"/></svg>';
    const angle = document.createElement('input'); angle.type = 'number'; angle.min = 0; angle.max = 360; angle.value = parsed.angle; angle.setAttribute('aria-label', 'Gradient angle'); const degrees = document.createElement('span'); degrees.textContent = '°'; angleRow.append(angle, degrees);
    const reverse = document.createElement('button'); reverse.type = 'button'; reverse.className = 'ink-v2-gradient-reverse'; reverse.title = 'Reverse gradient'; reverse.setAttribute('aria-label', reverse.title); reverse.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h10m0 0-2-2m2 2-2 2M13 11H3m0 0 2-2m-2 2 2 2"/></svg>';
    toolbar.append(kind, reverse, angleRow); wrapper.appendChild(toolbar);
    const cssColor = (stop) => stop.alpha >= 100 ? stop.color : `rgba(${[1, 3, 5].map((offset) => parseInt(stop.color.slice(offset, offset + 2), 16)).join(',')},${Math.max(0, Math.min(100, stop.alpha)) / 100})`;
    const commit = (stops = parsed.stops) => panel.setValue(control, node, `linear-gradient(${Number(angle.value) || 0}deg, ${stops.map((stop) => `${cssColor(stop)} ${Number(stop.position) || 0}%`).join(', ')})`);
    angle.addEventListener('change', () => commit());
    const rail = document.createElement('div'); rail.className = 'ink-v2-gradient-rail'; rail.style.background = `linear-gradient(${parsed.angle}deg, ${parsed.stops.map((stop) => `${cssColor(stop)} ${stop.position}%`).join(', ')})`;
    rail.title = 'Double-click to add a gradient stop';
    rail.addEventListener('dblclick', (event) => { const rect = rail.getBoundingClientRect(); const position = Math.round(clamp((event.clientX - rect.left) / rect.width) * 100); commit([...parsed.stops, { color: '#ffffff', alpha: 100, position }].sort((a, b) => a.position - b.position)); });
    parsed.stops.forEach((stop) => { const marker = document.createElement('button'); marker.type = 'button'; marker.className = 'ink-v2-gradient-marker'; marker.style.left = `${stop.position}%`; marker.style.setProperty('--ink-current-color', cssColor(stop)); marker.title = `Edit stop at ${stop.position}%`; marker.addEventListener('click', () => openColorStudio(marker, cssColor(stop), (next) => { const channels = colorChannels(next); stop.color = colorHex(channels); stop.alpha = Math.round(channels.a * 100); commit(); }, palette)); rail.appendChild(marker); });
    wrapper.appendChild(rail);
    reverse.addEventListener('click', () => commit(parsed.stops.map((stop) => ({ ...stop, position: 100 - Number(stop.position) })).reverse()));
    const stops = document.createElement('div'); stops.className = 'ink-v2-gradient-stops';
    const stopsHeader = document.createElement('div'); stopsHeader.className = 'ink-v2-gradient-stops-head'; stopsHeader.append('Stops');
    const add = document.createElement('button'); add.type = 'button'; add.title = 'Add gradient stop'; add.setAttribute('aria-label', add.title); add.textContent = '+'; add.addEventListener('click', () => commit([...parsed.stops, { color: '#ffffff', alpha: 100, position: 50 }].sort((a, b) => a.position - b.position))); stopsHeader.appendChild(add); stops.appendChild(stopsHeader);
    parsed.stops.forEach((stop, index) => {
        const stopRow = document.createElement('div'); stopRow.className = 'ink-v2-gradient-stop';
        const trigger = colorTrigger(cssColor(stop), (next) => { const channels = colorChannels(next); stop.color = colorHex(channels); stop.alpha = Math.round(channels.a * 100); commit(); }, palette);
        const positionField = document.createElement('label'); positionField.className = 'ink-v2-gradient-position';
        const position = document.createElement('input'); position.type = 'number'; position.min = 0; position.max = 100; position.title = 'Position (%)'; position.setAttribute('aria-label', position.title); position.value = stop.position; const percent = document.createElement('span'); percent.textContent = '%'; positionField.append(position, percent);
        const alphaField = document.createElement('label'); alphaField.className = 'ink-v2-gradient-alpha'; const alpha = document.createElement('input'); alpha.type = 'number'; alpha.min = 0; alpha.max = 100; alpha.value = stop.alpha; alpha.setAttribute('aria-label', 'Stop opacity (%)'); const alphaPercent = document.createElement('span'); alphaPercent.textContent = '%'; alphaField.append(alpha, alphaPercent);
        const remove = document.createElement('button'); remove.type = 'button'; remove.title = 'Remove stop'; remove.setAttribute('aria-label', 'Remove gradient stop'); remove.textContent = '×'; remove.disabled = parsed.stops.length <= 2;
        position.addEventListener('change', () => { stop.position = Number(position.value); commit(); });
        alpha.addEventListener('change', () => { stop.alpha = Math.max(0, Math.min(100, Number(alpha.value) || 0)); commit(); });
        remove.addEventListener('click', () => commit(parsed.stops.filter((_, cursor) => cursor !== index)));
        stopRow.append(positionField, trigger, alphaField, remove); stops.appendChild(stopRow);
    });
    wrapper.appendChild(stops); row.appendChild(wrapper); return row;
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

// Imported sites often implement a section background as a positioned image layer rather
// than CSS background-image. This control edits that native image node from the owning
// section, preserving the captured wrapper, mask, blend mode, and positioning rules.
export function importedBackground(panel, control, node, value, row) {
    const imageNode = panel.runtime.document.get(value);
    const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-media';
    const current = imageNode?.settings?.src || imageNode?.settings?.importedAttributes?.src || '';
    const currentUrl = typeof current === 'object' ? current.url || '' : current;
    const preview = document.createElement('div'); preview.className = 'ink-v2-media-preview';
    if (currentUrl) { const image = document.createElement('img'); image.src = currentUrl; image.alt = ''; preview.appendChild(image); }
    else preview.innerHTML = '<span>Imported image unavailable</span>';

    const replace = (next) => {
        if (!imageNode) return;
        const attributes = { ...(imageNode.settings.importedAttributes || {}) };
        if (next) attributes.src = next; else delete attributes.src;
        // Responsive candidates from the captured site would otherwise keep winning over
        // the newly selected source in the browser's image selection algorithm.
        delete attributes.srcset;
        delete attributes.sizes;
        panel.runtime.update(imageNode.id, { settings: { src: next, importedAttributes: attributes } }, 'Change imported background image');
    };

    const actions = document.createElement('div'); actions.className = 'ink-v2-media-actions';
    const library = document.createElement('button'); library.type = 'button'; library.textContent = 'Choose'; library.disabled = !imageNode; library.addEventListener('click', () => pickMedia(replace));
    const upload = document.createElement('button'); upload.type = 'button'; upload.textContent = 'Upload'; upload.disabled = !imageNode; upload.addEventListener('click', () => uploadMedia(panel.runtime.assetUploadHandler, 'image/*', replace));
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.disabled = !imageNode || !currentUrl; remove.addEventListener('click', () => replace(''));
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
    commitOnFinish(input, commit); options.querySelectorAll('input').forEach((field) => commitOnFinish(field, commit)); wrapper.append(input, options); row.appendChild(wrapper); return row;
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
        const shown = query ? all.filter((name) => name.includes(query)) : all;
        if (!shown.length) { grid.innerHTML = '<span class="ink-v2-icon-empty">No icons match</span>'; return; }
        const fragment = document.createDocumentFragment();
        shown.forEach((name) => {
            const button = document.createElement('button'); button.type = 'button'; button.title = name; button.className = resolved.library === active && resolved.name === name ? 'is-active' : '';
            button.setAttribute('aria-label', name);
            button.appendChild(renderIcon(document, iconValue(active, name)));
            button.addEventListener('click', () => panel.setValue(control, node, iconValue(active, name)));
            fragment.appendChild(button);
        });
        grid.appendChild(fragment);
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
    const shadows = Array.isArray(value) ? value : (value && typeof value === 'object' ? [value] : []);
    const enabled = shadows.length > 0;
    const controlHost = document.createElement('div'); controlHost.className = 'ink-v2-shadow-control';
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'ink-v2-shadow-toggle'; toggle.title = enabled ? 'Remove shadows' : 'Add shadow'; toggle.setAttribute('aria-label', toggle.title);
    toggle.innerHTML = `<span class="material-symbols-rounded">${enabled ? 'close' : 'edit'}</span>`;
    toggle.addEventListener('click', () => panel.setValue(control, node, enabled ? '' : { x: 0, y: 0, blur: 10, spread: 0, unit: 'px', color: '#000000', inset: false }));
    controlHost.appendChild(toggle);
    if (!enabled) { row.appendChild(controlHost); return row; }
    const layers = document.createElement('div'); layers.className = 'ink-v2-shadow-layers';
    const save = (next) => panel.setValue(control, node, next.length === 1 ? next[0] : next);
    shadows.forEach((shadow, index) => {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-shadow';
        const heading = document.createElement('div'); heading.className = 'ink-v2-shadow-heading'; heading.textContent = shadows.length > 1 ? `Shadow ${index + 1}` : 'Shadow';
        const remove = document.createElement('button'); remove.type = 'button'; remove.title = 'Remove shadow'; remove.setAttribute('aria-label', remove.title); remove.textContent = '×';
        remove.addEventListener('click', () => save(shadows.filter((_, cursor) => cursor !== index)));
        heading.appendChild(remove); wrapper.appendChild(heading);
        ['x', 'y', 'blur', ...(control.type === 'box-shadow' ? ['spread'] : [])].forEach((name) => {
            const field = document.createElement('label'); field.textContent = name;
            const input = document.createElement('input'); input.type = 'number'; input.value = shadow[name] ?? 0; input.dataset.shadowField = name; field.prepend(input); wrapper.appendChild(field);
        });
        let shadowColor = shadow.color || 'rgba(0,0,0,.25)';
        const commit = () => {
            const nextShadow = { unit: shadow.unit || 'px', color: shadowColor };
            wrapper.querySelectorAll('[data-shadow-field]').forEach((input) => { nextShadow[input.dataset.shadowField] = Number(input.value); });
            nextShadow.inset = wrapper.querySelector('[data-shadow-position]')?.value === 'inset';
            const next = structuredClone(shadows); next[index] = nextShadow; save(next);
        };
        const colorField = document.createElement('label'); colorField.className = 'ink-v2-shadow-color'; colorField.textContent = 'Color';
        const globals = panel.runtime.document.data.settings.theme?.colors || {};
        const colorButton = colorTrigger(shadowColor, (next) => { shadowColor = next; commit(); }, [...Object.values(globals), ...INK_COLOR_PALETTE]); colorField.prepend(colorButton); wrapper.appendChild(colorField);
        if (control.type === 'box-shadow') {
            const position = document.createElement('label'); position.className = 'ink-v2-shadow-position'; position.textContent = 'Position';
            const select = document.createElement('select'); select.dataset.shadowPosition = ''; select.add(new Option('Outline', 'outline')); select.add(new Option('Inset', 'inset')); select.value = shadow.inset ? 'inset' : 'outline'; position.prepend(select); wrapper.appendChild(position);
        }
        wrapper.querySelectorAll('input, select').forEach((input) => input.addEventListener('change', commit)); layers.appendChild(wrapper);
    });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'ink-v2-shadow-add'; add.textContent = '+ Add shadow';
    add.addEventListener('click', () => save([...shadows, { x: 0, y: 4, blur: 12, spread: 0, unit: 'px', color: 'rgba(0,0,0,.25)', inset: false }]));
    layers.appendChild(add); controlHost.appendChild(layers); row.appendChild(controlHost); return row;
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
    const styleValue = (name) => panel.currentValue({ ...control, name }, node);
    const settingValue = (name) => panel.currentValue({ ...control, target: 'settings', part: undefined, name }, node);
    let mode = panel.currentValue(modeControl, node);
    // Older, imported, and programmatically composed documents may already contain a
    // complete background without the newer mode marker. The panel must describe what
    // is actually rendered instead of presenting every type as inactive.
    if (!mode && !overlay) {
        const video = node.settings?.backgroundVideo;
        const slideshow = node.settings?.backgroundSlideshow;
        if (video?.url || video?.fallback || settingValue('backgroundVideoUrl') || settingValue('backgroundVideoFallback')) mode = 'video';
        else if ((Array.isArray(slideshow?.images) && slideshow.images.length) || (Array.isArray(settingValue('backgroundSlideshowImages')) && settingValue('backgroundSlideshowImages').length)) mode = 'slideshow';
    }
    if (!mode) {
        const image = styleValue(`${prefix}background-image`);
        const imageValue = typeof image === 'object' ? image?.url : image;
        if (/^(linear|radial|conic)-gradient\(/i.test(String(imageValue || '').trim())) mode = 'gradient';
        else if (imageValue || styleValue(`${prefix}background-color`)) mode = 'classic';
    }
    const typeRow = document.createElement('div'); typeRow.className = 'ink-v2-background-type';
    const label = document.createElement('span'); label.textContent = 'Background Type';
    const choices = document.createElement('div'); choices.className = 'ink-v2-background-choices'; choices.setAttribute('role', 'radiogroup'); choices.setAttribute('aria-label', overlay ? 'Overlay fill type' : 'Fill type');
    const backgroundChoices = [
        ['classic', 'square', 'Classic'],
        ['gradient', 'blend', 'Gradient'],
    ];
    if (!overlay && (control.state || 'base') === 'base') backgroundChoices.push(['video', 'square-play', 'Video'], ['slideshow', 'images', 'Slideshow']);
    backgroundChoices.forEach(([choiceValue, iconName, title]) => {
        const button = document.createElement('button'); button.type = 'button'; button.title = title; button.setAttribute('aria-label', title); button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', mode === choiceValue ? 'true' : 'false'); button.setAttribute('aria-pressed', mode === choiceValue ? 'true' : 'false'); button.classList.toggle('is-active', mode === choiceValue);
        button.appendChild(renderIcon(document, `lucide:${iconName}`, 'ink-v2-background-choice-icon'));
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
            const { wrapper: switcher, checkbox } = switchControl({ checked: !!dividerValue[key], ariaLabel: labelText }); checkbox.addEventListener('change', () => update({ [key]: checkbox.checked })); field(labelText, switcher);
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
    body.appendChild(sub({ name: 'font-family', type: 'font', label: 'Font family', options: ['inherit', 'system-ui, sans-serif', ...availableFonts(panel.runtime.document)] }));
    body.appendChild(sub({ name: 'font-size', type: 'size', label: 'Size', units: ['px', 'rem', 'em', 'vw'], responsive: true }));
    body.appendChild(sub({ name: 'font-weight', type: 'select', label: 'Weight', options: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] }));
    body.appendChild(sub({ name: 'font-style', type: 'select', label: 'Style', options: ['normal', 'italic', 'oblique'] }));
    body.appendChild(sub({ name: 'text-transform', type: 'select', label: 'Transform', options: ['none', 'uppercase', 'lowercase', 'capitalize'] }));
    body.appendChild(sub({ name: 'text-decoration', type: 'select', label: 'Decoration', options: ['none', 'underline', 'line-through', 'overline'] }));
    body.appendChild(sub({ name: 'line-height', type: 'size', label: 'Line height', units: ['', 'px', 'em'], responsive: true }));
    body.appendChild(sub({ name: 'letter-spacing', type: 'size', label: 'Letter spacing', units: ['px', 'em'], responsive: true }));
    body.appendChild(sub({ name: 'text-wrap', type: 'choose', label: 'Wrapping', options: [{ value: 'wrap', label: 'Wrap' }, { value: 'balance', label: 'Balance' }, { value: 'pretty', label: 'Pretty' }, { value: 'nowrap', label: 'No wrap' }], responsive: true }));
    body.appendChild(sub({ name: 'font-feature-settings', type: 'text', label: 'OpenType features', placeholder: '"liga" 1, "ss01" 1', description: 'Enable ligatures, stylistic sets, and other OpenType features.' }));
    body.appendChild(sub({ name: 'font-variation-settings', type: 'text', label: 'Variable axes', placeholder: '"wght" 650, "wdth" 90', description: 'Set axes exposed by a variable font.' }));
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
