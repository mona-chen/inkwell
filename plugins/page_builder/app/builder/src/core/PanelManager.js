import { pickMedia, uploadMedia } from './MediaPicker.js';

const labelFor = (option) => typeof option === 'object' ? option.label : String(option).replace(/-/g, ' ');
const valueFor = (option) => typeof option === 'object' ? option.value : option;

export default class PanelManager {
    constructor({ runtime, container, role = 'main' } = {}) {
        this.runtime = runtime;
        this.container = container;
        this.role = role; // 'main' (left panel: elements/site/history) | 'settings' | 'navigator' (Structure window)
        this.route = role === 'settings' ? 'settings' : role === 'navigator' ? 'navigator' : 'elements';
        this.activeTab = 'content';
        this.activeState = 'base'; // 'base' | 'hover' | 'focus' (Elementor Normal/Hover/Focus)
        this.collapsedNodes = new Set();
        this.navigatorDragId = null;
        this.unsubscribers = [];
    }

    mount() {
        this.container.classList.add('ink-v2-panel');
        if (this.role === 'settings') this.unsubscribers.push(this.runtime.events.on('selection:change', () => this.render()));
        if (this.role === 'navigator') this.unsubscribers.push(this.runtime.events.on('selection:change', () => this.render()));
        if (this.role !== 'settings') this.unsubscribers.push(this.runtime.events.on('document:update', () => this.render()));
        this.unsubscribers.push(this.runtime.events.on('document:settings', () => { if (this.route === 'site') this.render(); }));
        this.unsubscribers.push(this.runtime.events.on('history:change', () => { if (this.route === 'history') this.render(); }));
        if (this.role !== 'settings') this.unsubscribers.push(this.runtime.events.on('responsive:change', () => this.render()));
        if (this.role === 'navigator') {
            this.unsubscribers.push(this.runtime.events.on('document:insert', () => this.render()));
            this.unsubscribers.push(this.runtime.events.on('document:remove', () => this.render()));
            this.unsubscribers.push(this.runtime.events.on('document:move', () => this.render()));
            this.unsubscribers.push(this.runtime.events.on('document:replace', () => this.render()));
        }
        this.unsubscribers.push(this.runtime.events.on('library:open', () => { if (this.role === 'main') { this.route = 'elements'; this.render(); } }));
        this.render();
        return this;
    }

    // Compact per-screen title bar (back/close + title) for the routed main panel.
    screenTitle(title, icon, { back = false } = {}) {
        const header = document.createElement('header');
        header.className = 'ink-v2-screen-title';
        if (back) {
            const backButton = document.createElement('button');
            backButton.type = 'button'; backButton.className = 'ink-v2-screen-back'; backButton.setAttribute('aria-label', 'Back to elements');
            backButton.innerHTML = '<span class="material-symbols-rounded">arrow_back</span>';
            backButton.addEventListener('click', () => { this.route = 'elements'; this.render(); });
            header.appendChild(backButton);
        }
        const glyph = document.createElement('span'); glyph.className = 'ink-v2-screen-icon material-symbols-rounded'; glyph.textContent = icon;
        const strong = document.createElement('strong'); strong.textContent = title;
        header.append(glyph, strong);
        return header;
    }

    render() {
        this.container.replaceChildren();
        const body = document.createElement('div');
        body.className = 'ink-v2-panel-body';
        if (this.route === 'elements') body.appendChild(this.renderLibrary());
        if (this.route === 'settings') body.appendChild(this.renderSettings());
        if (this.route === 'navigator') body.appendChild(this.renderNavigator());
        if (this.route === 'site') body.appendChild(this.renderSiteSettings());
        if (this.route === 'history') body.appendChild(this.renderHistory());
        this.container.appendChild(body);
    }

    renderSiteSettings() {
        const settings = this.runtime.document.data.settings;
        const theme = settings.theme || {};
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-site-settings';
        wrapper.appendChild(this.screenTitle('Site Settings', 'tune', { back: true }));
        const section = (title) => { const el = document.createElement('section'); el.className = 'ink-v2-control-section'; el.innerHTML = `<h3>${title}</h3>`; wrapper.appendChild(el); return el; };
        const field = (host, label, value, type, commit, options = []) => {
            const row = document.createElement('div'); row.className = 'ink-v2-control'; const caption = document.createElement('label'); caption.textContent = label;
            const input = document.createElement(type === 'select' ? 'select' : 'input');
            if (type === 'select') options.forEach((option) => input.add(new Option(option, option))); else input.type = type;
            input.value = value ?? ''; input.addEventListener('change', () => commit(type === 'number' ? Number(input.value) : input.value)); row.append(caption, input); host.appendChild(row);
        };
        const page = section('Page');
        field(page, 'Page title', settings.title, 'text', (value) => this.runtime.updateDocumentSettings({ title: value }, 'Change page title'));
        field(page, 'Canvas background', settings.backgroundColor || '#ffffff', 'color', (value) => this.runtime.updateDocumentSettings({ backgroundColor: value }, 'Change canvas background'));
        const colors = section('Global colors');
        [['primary', '#6ec1e4'], ['secondary', '#54595f'], ['text', '#7a7a7a'], ['accent', '#61ce70']].forEach(([name, fallback]) => field(colors, name[0].toUpperCase() + name.slice(1), theme.colors?.[name] || fallback, 'color', (value) => this.updateTheme('colors', name, value)));
        const typography = section('Global typography');
        field(typography, 'Font family', theme.typography?.fontFamily || 'Inter,ui-sans-serif,system-ui,sans-serif', 'select', (value) => this.updateTheme('typography', 'fontFamily', value), ['Inter,ui-sans-serif,system-ui,sans-serif', 'Roboto,Arial,sans-serif', 'Georgia,serif', 'ui-monospace,SFMono-Regular,monospace']);
        field(typography, 'Base font size', theme.typography?.baseSize || 16, 'number', (value) => this.updateTheme('typography', 'baseSize', value));
        field(typography, 'Line height', theme.typography?.lineHeight || 1.5, 'number', (value) => this.updateTheme('typography', 'lineHeight', value));
        const spacing = section('Layout system');
        field(spacing, 'Content width', theme.spacing?.contentWidth || 1140, 'number', (value) => this.updateTheme('spacing', 'contentWidth', value));
        field(spacing, 'Page gutter', theme.spacing?.pageGutter ?? 10, 'number', (value) => this.updateTheme('spacing', 'pageGutter', value));
        field(spacing, 'Section gap', theme.spacing?.sectionGap ?? 0, 'number', (value) => this.updateTheme('spacing', 'sectionGap', value));
        const breakpoints = section('Responsive breakpoints');
        field(breakpoints, 'Tablet', settings.breakpoints?.tablet || 1024, 'number', (value) => this.runtime.updateDocumentSettings({ breakpoints: { ...settings.breakpoints, tablet: value } }, 'Change tablet breakpoint'));
        field(breakpoints, 'Mobile', settings.breakpoints?.mobile || 767, 'number', (value) => this.runtime.updateDocumentSettings({ breakpoints: { ...settings.breakpoints, mobile: value } }, 'Change mobile breakpoint'));
        return wrapper;
    }

    updateTheme(group, name, value) {
        const theme = structuredClone(this.runtime.document.data.settings.theme || {});
        theme[group] = { ...(theme[group] || {}), [name]: value };
        this.runtime.updateDocumentSettings({ theme }, `Change global ${name}`);
    }

    renderHistory() {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-history';
        const history = this.runtime.history;
        const { undo, redo } = history.entries();
        wrapper.appendChild(this.screenTitle('History', 'history', { back: true }));
        const action = document.createElement('div'); action.className = 'ink-v2-history-actions';
        const undoButton = document.createElement('button'); undoButton.type = 'button'; undoButton.textContent = 'Undo'; undoButton.disabled = !undo.length; undoButton.addEventListener('click', () => history.undo());
        const redoButton = document.createElement('button'); redoButton.type = 'button'; redoButton.textContent = 'Redo'; redoButton.disabled = !redo.length; redoButton.addEventListener('click', () => history.redo());
        action.append(undoButton, redoButton); wrapper.appendChild(action);
        if (redo.length) {
            const heading = document.createElement('h3'); heading.textContent = 'Redo'; wrapper.appendChild(heading);
            redo.forEach((label, index) => {
                const item = document.createElement('button'); item.type = 'button'; item.className = 'ink-v2-history-item is-redo';
                item.innerHTML = `<span class="material-symbols-rounded">redo</span><span>${label}</span>`;
                item.addEventListener('click', () => { let n = index + 1; while (n--) history.redo(); });
                wrapper.appendChild(item);
            });
        }
        if (undo.length) {
            const heading = document.createElement('h3'); heading.textContent = 'Undo'; wrapper.appendChild(heading);
            undo.forEach((label, index) => {
                const item = document.createElement('button'); item.type = 'button'; item.className = 'ink-v2-history-item is-undo';
                if (index === 0) item.classList.add('is-current');
                item.innerHTML = `<span class="material-symbols-rounded">${index === 0 ? 'radio_button_checked' : 'undo'}</span><span>${label}</span>`;
                item.addEventListener('click', () => { let n = index + 1; while (n--) history.undo(); });
                wrapper.appendChild(item);
            });
        }
        if (!undo.length && !redo.length) {
            const empty = document.createElement('p'); empty.className = 'ink-v2-history-empty'; empty.textContent = 'No changes yet — every edit becomes an undoable step here.';
            wrapper.appendChild(empty);
        }
        return wrapper;
    }

    renderBackgroundControl(control, node, row) {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-background';
        const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'ink-v2-background-trigger'; trigger.setAttribute('aria-expanded', 'false');
        trigger.innerHTML = '<span class="material-symbols-rounded">format_color_fill</span><span>Background</span>';
        const body = document.createElement('div'); body.className = 'ink-v2-background-body';
        const sub = (partial) => this.renderControl({ tab: control.tab, target: control.target, section: control.section, ...partial }, node);
        body.appendChild(sub({ name: 'background-color', type: 'color', label: 'Color' }));
        body.appendChild(sub({ name: 'background-image', type: 'media', label: 'Image' }));
        body.appendChild(sub({ name: 'background-image', type: 'gradient', label: 'Gradient' }));
        body.appendChild(sub({ name: 'background-size', type: 'select', label: 'Size', options: ['auto', 'cover', 'contain'] }));
        body.appendChild(sub({ name: 'background-position', type: 'select', label: 'Position', options: ['center center', 'center top', 'center bottom', 'left center', 'right center'] }));
        body.appendChild(sub({ name: 'background-repeat', type: 'select', label: 'Repeat', options: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'] }));
        const toggle = () => { const open = wrapper.classList.toggle('is-open'); trigger.setAttribute('aria-expanded', open ? 'true' : 'false'); };
        trigger.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); toggle(); });
        wrapper.append(trigger, body); row.appendChild(wrapper); return row;
    }

    renderTypographyControl(control, node, row) {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-background ink-v2-typography';
        const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'ink-v2-background-trigger'; trigger.setAttribute('aria-expanded', 'false');
        trigger.innerHTML = '<span class="material-symbols-rounded">text_fields</span><span>Typography</span>';
        const body = document.createElement('div'); body.className = 'ink-v2-background-body';
        const sub = (partial) => this.renderControl({ tab: control.tab, target: control.target, section: control.section, ...partial }, node);
        body.appendChild(sub({ name: 'font-family', type: 'font', label: 'Font family', options: ['inherit', 'Inter', 'Roboto', 'Arial', 'Georgia', 'Times New Roman', 'monospace'] }));
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

    renderStructureControl(control, node, row) {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-structure';
        const grid = document.createElement('div'); grid.className = 'ink-v2-structure-grid';
        (control.options || []).forEach((option) => {
            const preset = String(valueFor(option)); const widths = preset.split(',').map(Number);
            const button = document.createElement('button'); button.type = 'button'; button.title = labelFor(option);
            const current = node.settings[control.name] || node.settings.structure;
            button.classList.toggle('is-active', String(current) === preset);
            button.setAttribute('aria-label', labelFor(option) || preset);
            button.innerHTML = `<span class="ink-v2-structure-cols">${widths.map((w) => `<i style="flex:${w}"></i>`).join('')}</span><span class="ink-v2-structure-label">${labelFor(option)}</span>`;
            button.addEventListener('click', () => { this.applyStructure(node, preset); this.render(); });
            grid.appendChild(button);
        });
        wrapper.appendChild(grid); row.appendChild(wrapper); return row;
    }

    renderPopoverToggleControl(control, node, row) {
        const details = document.createElement('details'); details.className = 'ink-v2-popover'; const summary = document.createElement('summary'); summary.textContent = control.text || 'Open settings'; details.appendChild(summary);
        (control.controls || []).forEach((nested) => details.appendChild(this.renderControl({ tab: control.tab, section: control.section, target: control.target, ...nested }, node))); row.appendChild(details); return row;
    }

    renderNoticeControl(control, node, row) {
        row.classList.add(`ink-v2-control-${control.type}`);
        if (control.type === 'divider') row.appendChild(document.createElement('hr'));
        else { const message = document.createElement(control.type === 'heading' ? 'h4' : 'div'); message.textContent = control.text || control.content || control.label; row.replaceChildren(message); }
        return row;
    }

    renderActionButtonControl(control, node, row) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'ink-v2-action-button'; button.textContent = control.text || control.label;
        button.addEventListener('click', () => control.onClick?.({ runtime: this.runtime, node, control })); row.appendChild(button); return row;
    }

    renderHiddenControl(control, node, row) { row.hidden = true; return row; }

    renderSwitcherControl(control, node, value, row) {
        const wrapper = document.createElement('label'); wrapper.className = 'ink-v2-switch';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = value === true || value === control.returnValue || value === 'yes';
        const track = document.createElement('span'); track.dataset.on = control.onLabel || 'Yes'; track.dataset.off = control.offLabel || 'No';
        checkbox.addEventListener('change', () => this.setValue(control, node, checkbox.checked ? (control.returnValue ?? true) : (control.offValue ?? false)));
        wrapper.append(checkbox, track); row.appendChild(wrapper); return row;
    }

    renderSliderControl(control, node, value, row) {
        const slider = document.createElement('div'); slider.className = 'ink-v2-slider';
        const range = document.createElement('input'); range.type = 'range'; range.min = control.min ?? 0; range.max = control.max ?? 100; range.step = control.step ?? 1;
        const number = document.createElement('input'); number.type = 'number'; number.min = range.min; number.max = range.max; number.step = range.step;
        const size = value && typeof value === 'object' ? value.size : value;
        range.value = size ?? control.default ?? 0; number.value = range.value;
        const commit = (source) => { range.value = source.value; number.value = source.value; this.setValue(control, node, control.units ? { size: Number(source.value), unit: value?.unit || control.units[0] } : Number(source.value)); };
        range.addEventListener('input', () => commit(range)); number.addEventListener('change', () => commit(number)); slider.append(range, number); row.appendChild(slider); return row;
    }

    renderGapsControl(control, node, value, row) {
        const gaps = value && typeof value === 'object' ? value : {};
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-gaps';
        const rowGap = document.createElement('input'); rowGap.type = 'number'; rowGap.placeholder = 'Row'; rowGap.value = gaps.row ?? '';
        const columnGap = document.createElement('input'); columnGap.type = 'number'; columnGap.placeholder = 'Column'; columnGap.value = gaps.column ?? '';
        const unit = document.createElement('select'); (control.units || ['px']).forEach((name) => unit.add(new Option(name, name))); unit.value = gaps.unit || control.units?.[0] || 'px';
        let linked = gaps.linked !== false; const link = document.createElement('button'); link.type = 'button'; link.className = 'ink-v2-link-values'; link.title = 'Link row and column gap'; link.setAttribute('aria-label', link.title); link.innerHTML = '<span class="material-symbols-rounded">link</span>'; link.classList.toggle('is-active', linked);
        const commit = (source) => { if (linked && source === rowGap) columnGap.value = rowGap.value; if (linked && source === columnGap) rowGap.value = columnGap.value; this.setValue(control, node, { row: Number(rowGap.value) || 0, column: Number(columnGap.value) || 0, unit: unit.value, linked }); };
        link.addEventListener('click', () => { linked = !linked; link.classList.toggle('is-active', linked); if (linked) { columnGap.value = rowGap.value; commit(); } });
        rowGap.addEventListener('change', () => commit(rowGap)); columnGap.addEventListener('change', () => commit(columnGap)); unit.addEventListener('change', () => commit()); wrapper.append(rowGap, columnGap, unit, link); row.appendChild(wrapper); return row;
    }

    renderDimensionsControl(control, node, value, row) {
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
            this.setValue(control, node, { top: Number(sides[0].value) || 0, right: Number(sides[1].value) || 0, bottom: Number(sides[2].value) || 0, left: Number(sides[3].value) || 0, unit: unit.value, linked });
        };
        inputs.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => commit(input))); unit.addEventListener('change', () => commit()); link.addEventListener('click', () => { linked = !linked; link.classList.toggle('is-active', linked); if (linked) commit(inputs.querySelector('input')); });
        row.appendChild(inputs); return row;
    }

    renderLibrary() {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-library';
        wrapper.appendChild(this.screenTitle('Elements', 'widgets'));
        const search = document.createElement('input');
        search.type = 'search'; search.className = 'ink-v2-search'; search.placeholder = 'Search elements';
        const groups = document.createElement('div');
        const draw = (query = '') => {
            groups.replaceChildren();
            const definitions = this.runtime.elements.list().filter((definition) => `${definition.title} ${definition.keywords.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
            const categorized = Map.groupBy ? Map.groupBy(definitions, (definition) => definition.category) : definitions.reduce((map, definition) => map.set(definition.category, [...(map.get(definition.category) || []), definition]), new Map());
            categorized.forEach((items, category) => {
                const section = document.createElement('details'); section.className = 'ink-v2-library-section'; section.open = true;
                section.innerHTML = `<summary><strong>${category}</strong><span class="material-symbols-rounded">expand_more</span></summary><div class="ink-v2-library-grid"></div>`;
                const grid = section.querySelector('.ink-v2-library-grid');
                items.forEach((definition) => {
                    const item = document.createElement('button'); item.type = 'button'; item.className = 'ink-v2-library-item';
                    item.draggable = true; item.dataset.inkElementType = definition.type;
                    item.innerHTML = `<span class="material-symbols-rounded">${definition.icon}</span><span>${definition.title}</span>`;
                    item.addEventListener('click', () => this.insertDefinition(definition.type));
                    grid.appendChild(item);
                });
                groups.appendChild(section);
            });
            if (!groups.children.length) {
                const empty = document.createElement('div'); empty.className = 'ink-v2-library-empty'; empty.textContent = 'No elements match your search.';
                groups.appendChild(empty);
            }
        };
        search.addEventListener('input', () => draw(search.value));
        draw();
        wrapper.append(search, groups); return wrapper;
    }

    insertDefinition(type) {
        const selected = this.runtime.selection.selectedId && this.runtime.document.get(this.runtime.selection.selectedId);
        let overrides = {};
        if (type === 'columns') {
            overrides = { settings: { structure: '50,50' }, children: [this.runtime.create('column'), this.runtime.create('column')] };
        }
        const candidate = this.runtime.create(type, overrides);
        const target = selected && this.runtime.elements.accepts(selected, candidate) ? { parentId: selected.id } : {};
        const node = this.runtime.insert(type, target, overrides);
        this.runtime.selection.select(node.id);
    }

    renderSettings() {
        const node = this.runtime.document.get(this.runtime.selection.selectedId);
        if (!node) {
            const empty = document.createElement('div');
            empty.className = 'ink-v2-panel-empty';
            empty.innerHTML = '<span class="material-symbols-rounded">touch_app</span><p>Select an element on the canvas to edit it.</p>';
            return empty;
        }
        const definition = this.runtime.elements.get(node.type);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<div class="ink-v2-element-title"><button type="button" data-back aria-label="Back to elements"><span class="material-symbols-rounded">arrow_back</span></button><span class="ink-v2-edit-label">Edit</span><strong>${definition.title}</strong></div><div class="ink-v2-control-tabs"></div><div class="ink-v2-controls"></div>`;
        wrapper.querySelector('[data-back]').addEventListener('click', () => { this.runtime.selection.clear(); if (window.sidebarTabManager) window.sidebarTabManager.openTab(document.querySelector('[data-tab="widgets"]')); const main = this.runtime.panel; if (main) { main.route = 'elements'; main.render(); } });
        const tabs = wrapper.querySelector('.ink-v2-control-tabs');
        const availableTabs = ['content', 'style', 'advanced'].filter((tab) => definition.controls.some((control) => control.tab === tab));
        if (!availableTabs.includes(this.activeTab)) this.activeTab = availableTabs[0] || 'content';
        availableTabs.forEach((tab) => {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = tab; button.className = tab === this.activeTab ? 'is-active' : '';
            button.addEventListener('click', () => { this.activeTab = tab; this.render(); }); tabs.appendChild(button);
        });
        const controlsHost = wrapper.querySelector('.ink-v2-controls');
        const sections = new Map();
        const tabControls = definition.controls.filter((control) => control.tab === this.activeTab && this.controlIsActive(control, node));
        // Normal / Hover / Focus state switcher (Elementor-style) when any control supports states.
        if ((this.activeTab === 'style' || this.activeTab === 'advanced') && tabControls.some((control) => control.states)) {
            const states = document.createElement('div'); states.className = 'ink-v2-states';
            [['base', 'Normal'], ['hover', 'Hover'], ['focus', 'Focus']].forEach(([state, label]) => {
                const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.className = this.activeState === state ? 'is-active' : '';
                button.addEventListener('click', () => { this.activeState = state; this.render(); }); states.appendChild(button);
            });
            controlsHost.appendChild(states);
        }
        tabControls.forEach((control) => {
            if (!sections.has(control.section)) {
                const section = document.createElement('details'); section.className = 'ink-v2-control-section'; section.open = true; section.innerHTML = `<summary><span>${control.section}</span><span class="material-symbols-rounded">expand_more</span></summary>`;
                sections.set(control.section, section); controlsHost.appendChild(section);
            }
            sections.get(control.section).appendChild(this.renderControl(control, node));
        });
        return wrapper;
    }

    controlIsActive(control, node) {
        if (!control.condition) return true;
        const test = (conditions) => Object.entries(conditions).every(([name, expected]) => {
            const actual = node.settings[name] ?? node.styles.base?.[name];
            if (Array.isArray(expected)) return expected.includes(actual);
            if (expected === '__not_empty__') return actual !== undefined && actual !== null && actual !== '';
            return actual === expected;
        });
        const condition = control.condition;
        if (condition.any) return condition.any.some(test);
        if (condition.all) return condition.all.every(test);
        if (condition.not) return !test(condition.not);
        return test(condition);
    }

    currentValue(control, node) {
        if (control.target === 'settings' || (control.target !== 'styles' && control.tab === 'content')) return node.settings[control.name] ?? '';
        const device = this.runtime.responsive.device;
        const bucket = control.responsive ? (device === 'desktop' ? 'base' : device) : (control.state || 'base');
        return node.styles[bucket]?.[control.name] ?? '';
    }

    setValue(control, node, value) {
        if (control.target === 'settings' || (control.target !== 'styles' && control.tab === 'content')) this.runtime.update(node.id, { settings: { [control.name]: value } }, `Change ${control.label}`);
        else {
            const device = this.runtime.responsive.device;
            const bucket = control.responsive ? (device === 'desktop' ? 'base' : device) : (control.state || 'base');
            this.runtime.update(node.id, { styles: { [bucket]: { ...(node.styles[bucket] || {}), [control.name]: value } } }, `Change ${control.label}`);
        }
    }

    mediaValue(control, value, url) {
        return value && typeof value === 'object' && !Array.isArray(value) ? { ...value, url } : url;
    }

    renderMediaControl(control, node, value, row) {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-media';
        const url = typeof value === 'object' ? value?.url || '' : value || '';
        const preview = document.createElement('div'); preview.className = 'ink-v2-media-preview';
        if (/^linear-gradient\(/.test(url) || /^radial-gradient\(/.test(url)) { preview.style.background = url; preview.style.backgroundSize = 'cover'; preview.innerHTML = '<span>Gradient background</span>'; }
        else if (url && /\.(mp4|webm|ogg)(\?|$)/i.test(url)) { const video = document.createElement('video'); video.src = url; video.muted = true; preview.appendChild(video); }
        else if (url) { const image = document.createElement('img'); image.src = url; image.alt = ''; preview.appendChild(image); }
        else preview.innerHTML = '<span>No media selected</span>';
        const actions = document.createElement('div'); actions.className = 'ink-v2-media-actions';
        const library = document.createElement('button'); library.type = 'button'; library.textContent = 'Choose'; library.addEventListener('click', () => pickMedia((next) => this.setValue(control, node, this.mediaValue(control, value, next))));
        const upload = document.createElement('button'); upload.type = 'button'; upload.textContent = 'Upload'; upload.addEventListener('click', () => uploadMedia(this.runtime.assetUploadHandler, control.accept, (next) => this.setValue(control, node, this.mediaValue(control, value, next))));
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.disabled = !url; remove.addEventListener('click', () => this.setValue(control, node, this.mediaValue(control, value, '')));
        actions.append(library, upload, remove); wrapper.append(preview, actions); row.appendChild(wrapper); return row;
    }

    renderGalleryControl(control, node, value, row) {
        const images = Array.isArray(value) ? value : [];
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-gallery';
        const thumbnails = document.createElement('div'); thumbnails.className = 'ink-v2-gallery-thumbnails';
        images.forEach((item, index) => {
            const tile = document.createElement('button'); tile.type = 'button'; tile.title = 'Remove image';
            const image = document.createElement('img'); image.src = typeof item === 'string' ? item : item.url; image.alt = ''; tile.appendChild(image);
            tile.addEventListener('click', () => this.setValue(control, node, images.filter((_, cursor) => cursor !== index))); thumbnails.appendChild(tile);
        });
        const actions = document.createElement('div'); actions.className = 'ink-v2-media-actions';
        const add = document.createElement('button'); add.type = 'button'; add.textContent = 'Add images'; add.addEventListener('click', () => pickMedia((url) => this.setValue(control, node, [...images, { url }])));
        const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Clear'; clear.disabled = !images.length; clear.addEventListener('click', () => this.setValue(control, node, []));
        actions.append(add, clear); wrapper.append(thumbnails, actions); row.appendChild(wrapper); return row;
    }

    renderShadowControl(control, node, value, row) {
        const shadow = value && typeof value === 'object' ? value : {};
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-shadow';
        ['x', 'y', 'blur', ...(control.type === 'box-shadow' ? ['spread'] : [])].forEach((name) => {
            const field = document.createElement('label'); field.textContent = name;
            const input = document.createElement('input'); input.type = 'number'; input.value = shadow[name] ?? 0; input.dataset.shadowField = name; field.prepend(input); wrapper.appendChild(field);
        });
        const color = document.createElement('input'); color.type = 'color'; color.value = /^#[0-9a-f]{6}$/i.test(shadow.color || '') ? shadow.color : '#000000'; color.dataset.shadowField = 'color'; wrapper.appendChild(color);
        if (control.type === 'box-shadow') { const inset = document.createElement('label'); inset.className = 'ink-v2-shadow-inset'; const check = document.createElement('input'); check.type = 'checkbox'; check.checked = !!shadow.inset; inset.append(check, ' Inset'); wrapper.appendChild(inset); }
        const commit = () => { const next = { unit: shadow.unit || 'px' }; wrapper.querySelectorAll('[data-shadow-field]').forEach((input) => { next[input.dataset.shadowField] = input.type === 'number' ? Number(input.value) : input.value; }); next.inset = wrapper.querySelector('.ink-v2-shadow-inset input')?.checked || false; this.setValue(control, node, next); };
        wrapper.querySelectorAll('input').forEach((input) => input.addEventListener('change', commit)); row.appendChild(wrapper); return row;
    }

    renderRepeaterControl(control, node, value, row) {
        const items = Array.isArray(value) ? value : [];
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-repeater';
        const update = (next) => this.setValue(control, node, next);
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

    renderUrlControl(control, node, value, row) {
        const link = value && typeof value === 'object' ? value : { url: value || '' };
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-url';
        const input = document.createElement('input'); input.type = 'url'; input.placeholder = 'https://'; input.value = link.url || '';
        const options = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '⚙'; options.appendChild(summary);
        [['isExternal', 'Open in new window'], ['nofollow', 'Add nofollow']].forEach(([name, text]) => { const label = document.createElement('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!link[name]; checkbox.dataset.urlOption = name; label.append(checkbox, text); options.appendChild(label); });
        const attributes = document.createElement('input'); attributes.type = 'text'; attributes.placeholder = 'key|value, key|value'; attributes.value = link.customAttributes || ''; attributes.dataset.urlAttributes = ''; options.appendChild(attributes);
        const commit = () => { const next = { url: input.value, customAttributes: attributes.value }; options.querySelectorAll('[data-url-option]').forEach((checkbox) => { next[checkbox.dataset.urlOption] = checkbox.checked; }); this.setValue(control, node, control.multiple || typeof value === 'object' ? next : next.url); };
        input.addEventListener('change', commit); options.querySelectorAll('input').forEach((field) => field.addEventListener('change', commit)); wrapper.append(input, options); row.appendChild(wrapper); return row;
    }

    renderIconControl(control, node, value, row) {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-icons';
        const options = control.options || ['star', 'favorite', 'home', 'person', 'settings', 'search', 'check', 'close', 'arrow_forward', 'play_arrow', 'mail', 'phone'];
        options.forEach((option) => { const icon = valueFor(option); const button = document.createElement('button'); button.type = 'button'; button.title = labelFor(option); button.className = value === icon ? 'is-active' : ''; button.innerHTML = `<span class="material-symbols-rounded">${icon}</span>`; button.addEventListener('click', () => this.setValue(control, node, icon)); wrapper.appendChild(button); });
        const custom = document.createElement('input'); custom.type = 'text'; custom.placeholder = 'Icon name or SVG'; custom.value = value || ''; custom.addEventListener('change', () => this.setValue(control, node, custom.value)); row.append(wrapper, custom); return row;
    }

    renderBorderControl(control, node, value, row) {
        const border = value && typeof value === 'object' ? value : {};
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-border';
        const width = document.createElement('input'); width.type = 'number'; width.value = typeof border.width === 'object' ? border.width.size : border.width ?? 1;
        const style = document.createElement('select'); ['none', 'solid', 'double', 'dotted', 'dashed', 'groove'].forEach((name) => style.add(new Option(name, name))); style.value = border.style || 'solid';
        const color = document.createElement('input'); color.type = 'color'; color.value = /^#[0-9a-f]{6}$/i.test(border.color || '') ? border.color : '#000000';
        const commit = () => this.setValue(control, node, { width: Number(width.value), unit: border.unit || 'px', style: style.value, color: color.value });
        [width, style, color].forEach((input) => input.addEventListener('change', commit)); wrapper.append(width, style, color); row.appendChild(wrapper); return row;
    }

    renderWysiwygControl(control, node, value, row) {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-wysiwyg';
        const toolbar = document.createElement('div');
        const commands = [
            ['bold', 'B', 'bold'], ['italic', 'I', 'italic'], ['underline', 'U', 'underline'], ['strikeThrough', 'S', 'strikeThrough'],
            ['insertUnorderedList', '• List', 'insertUnorderedList'], ['insertOrderedList', '1. List', 'insertOrderedList'], ['createLink', 'Link', null],
        ];
        const buttons = commands.map(([command, label, stateCommand]) => {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.cmd = command;
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const argument = command === 'createLink' ? (window.prompt('Link URL', 'https://') || undefined) : null;
                if (command === 'createLink' && !argument) return;
                this.wysiwygFocus(editor);
                document.execCommand(command, false, argument || undefined);
                editor.focus();
                refreshActive();
            });
            toolbar.appendChild(button);
            return { button, stateCommand };
        });
        const refreshActive = () => {
            this.wysiwygFocus(editor);
            buttons.forEach(({ button, stateCommand }) => {
                if (!stateCommand) return;
                let active = false;
                try { active = document.queryCommandState(stateCommand); } catch (_) {}
                button.classList.toggle('is-active', active);
            });
        };
        const editor = document.createElement('div'); editor.contentEditable = 'true'; editor.innerHTML = value || '';
        editor.addEventListener('input', () => { /* live; committed on blur */ });
        editor.addEventListener('blur', () => { const active = document.activeElement && toolbar.contains(document.activeElement) ? null : this; if (active === this) this.setValue(control, node, editor.innerHTML); });
        editor.addEventListener('keyup', refreshActive); editor.addEventListener('mouseup', refreshActive);
        // A click inside the toolbar keeps focus in the editor so formatting applies.
        toolbar.addEventListener('mousedown', (event) => event.preventDefault());
        wrapper.append(toolbar, editor); row.appendChild(wrapper); return row;
    }

    wysiwygFocus(editor) {
        if (document.activeElement === editor) return;
        editor.focus();
        const selection = window.getSelection();
        if (selection && selection.rangeCount === 0) {
            const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
            selection.removeAllRanges(); selection.addRange(range);
        }
    }

    renderImageDimensionsControl(control, node, value, row) {
        const dimensions = value && typeof value === 'object' ? value : {};
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-image-dimensions';
        const width = document.createElement('input'); width.type = 'number'; width.placeholder = 'Width'; width.value = dimensions.width ?? '';
        const height = document.createElement('input'); height.type = 'number'; height.placeholder = 'Height'; height.value = dimensions.height ?? '';
        const unit = document.createElement('select'); (control.units || ['px', '%']).forEach((name) => unit.add(new Option(name, name))); unit.value = dimensions.unit || control.units?.[0] || 'px';
        const commit = () => this.setValue(control, node, { width: Number(width.value) || 0, height: Number(height.value) || 0, unit: unit.value });
        [width, height, unit].forEach((input) => input.addEventListener('change', commit)); wrapper.append(width, height, unit); row.appendChild(wrapper); return row;
    }

    renderColorControl(control, node, value, row) {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-color-control';
        const globals = this.runtime.document.data.settings.theme?.colors || {};
        const palette = { primary: '#2563eb', secondary: '#7c3aed', text: '#18181b', accent: '#f59e0b', ...globals };
        const swatches = document.createElement('div'); swatches.className = 'ink-v2-global-colors';
        Object.entries(palette).forEach(([name, color]) => {
            const button = document.createElement('button'); button.type = 'button'; button.title = `Global ${name}`; button.setAttribute('aria-label', `Use global ${name}`); button.style.setProperty('--swatch', color); button.classList.toggle('is-active', value === `var(--ink-color-${name})`); button.addEventListener('click', () => this.setValue(control, node, `var(--ink-color-${name})`)); swatches.appendChild(button);
        });
        const custom = document.createElement('div'); custom.className = 'ink-v2-custom-color';
        const color = document.createElement('input'); color.type = 'color'; color.value = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
        const alpha = document.createElement('input'); alpha.type = 'range'; alpha.min = 0; alpha.max = 100; alpha.value = 100; alpha.title = 'Opacity';
        const commit = () => { const hex = color.value; const opacity = Number(alpha.value) / 100; if (opacity === 1) this.setValue(control, node, hex); else { const parts = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)); this.setValue(control, node, `rgba(${parts.join(',')},${opacity})`); } };
        color.addEventListener('change', commit); alpha.addEventListener('change', commit); custom.append(color, alpha); wrapper.append(swatches, custom); row.appendChild(wrapper); return row;
    }

    renderCssFiltersControl(control, node, value, row) {
        const filters = value && typeof value === 'object' ? value : {};
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-css-filters';
        [['blur', 0, 20, 1], ['brightness', 0, 200, 5], ['contrast', 0, 200, 5], ['saturate', 0, 200, 5], ['hue', 0, 360, 5]].forEach(([name, min, max, step]) => { const label = document.createElement('label'); label.textContent = name; const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = filters[name] ?? (name === 'blur' || name === 'hue' ? 0 : 100); input.dataset.filter = name; label.appendChild(input); wrapper.appendChild(label); });
        const commit = () => { const next = {}; wrapper.querySelectorAll('[data-filter]').forEach((input) => { next[input.dataset.filter] = Number(input.value); }); this.setValue(control, node, next); }; wrapper.querySelectorAll('input').forEach((input) => input.addEventListener('change', commit)); row.appendChild(wrapper); return row;
    }

    renderTextStrokeControl(control, node, value, row) {
        const stroke = value && typeof value === 'object' ? value : {}; const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-text-stroke';
        const width = document.createElement('input'); width.type = 'number'; width.min = 0; width.value = stroke.strokeWidth ?? 0; const color = document.createElement('input'); color.type = 'color'; color.value = /^#[0-9a-f]{6}$/i.test(stroke.color || '') ? stroke.color : '#000000';
        const commit = () => this.setValue(control, node, { strokeWidth: Number(width.value) || 0, unit: 'px', color: color.value }); width.addEventListener('change', commit); color.addEventListener('change', commit); wrapper.append(width, color); row.appendChild(wrapper); return row;
    }

    renderGradientControl(control, node, value, row) {
        const parsed = (() => { const m = /^(linear-gradient)\((\d+)deg,\s*([^,]+),\s*([^)]+)\)$/.exec(String(value || '')); if (!m) return null; return { angle: Number(m[2]), from: m[3].trim(), to: m[4].trim() }; })();
        const angle = document.createElement('input'); angle.type = 'number'; angle.min = 0; angle.max = 360; angle.value = parsed?.angle ?? 90;
        const from = document.createElement('input'); from.type = 'color'; from.value = /^#[0-9a-f]{6}$/i.test(parsed?.from || '') ? parsed.from : '#6ec1e4';
        const to = document.createElement('input'); to.type = 'color'; to.value = /^#[0-9a-f]{6}$/i.test(parsed?.to || '') ? parsed.to : '#4054b2';
        const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Remove'; clear.disabled = !value;
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-gradient';
        const commit = () => this.setValue(control, node, `linear-gradient(${Number(angle.value) || 90}deg, ${from.value}, ${to.value})`);
        angle.addEventListener('change', commit); from.addEventListener('change', commit); to.addEventListener('change', commit);
        clear.addEventListener('click', () => this.setValue(control, node, ''));
        wrapper.append(angle, from, to, clear); row.appendChild(wrapper); return row;
    }

    renderResponsiveSwitcher(control, node) {
        const device = this.runtime.responsive.device;
        const icons = { desktop: 'desktop_windows', tablet: 'tablet', mobile: 'smartphone' };
        const holder = document.createElement('div'); holder.className = 'ink-v2-responsive-switcher';
        const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'ink-v2-responsive-trigger'; trigger.title = 'Responsive mode'; trigger.setAttribute('aria-label', 'Responsive mode'); trigger.innerHTML = `<span class="material-symbols-rounded">${icons[device]}</span>`;
        const popover = document.createElement('div'); popover.className = 'ink-v2-responsive-menu'; popover.setAttribute('role', 'menu');
        ['desktop', 'tablet', 'mobile'].forEach((name) => {
            const button = document.createElement('button'); button.type = 'button'; button.className = name === device ? 'is-active' : ''; button.setAttribute('role', 'menuitem');
            button.innerHTML = `<span class="material-symbols-rounded">${icons[name]}</span><span>${name[0].toUpperCase() + name.slice(1)}</span>`;
            button.addEventListener('click', () => { this.setDevice(name); holder.classList.remove('is-open'); this.render(); });
            popover.appendChild(button);
        });
        trigger.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); holder.classList.toggle('is-open'); });
        document.addEventListener('click', (event) => { if (!holder.contains(event.target)) holder.classList.remove('is-open'); });
        holder.append(trigger, popover);
        return holder;
    }

    setDevice(device) {
        const button = document.querySelector(`.ink-appbar-center [id="${device}ModeButton"]`);
        if (button) { button.click(); return; }
        const builder = window.builder;
        if (builder && typeof builder.setDevice === 'function') builder.setDevice(device);
        else this.runtime.responsive.setDevice(device);
    }

    // Ink section/columns structure presets: set widths and reconcile child columns.
    applyStructure(node, structure) {
        const runtime = this.runtime;
        const count = String(structure).split(',').length;
        runtime.history.begin(`Set ${count}-column structure`);
        if (node.type === 'section') {
            (node.children || []).filter((child) => child.type === 'columns').forEach((child) => runtime.remove(child.id));
            const columns = runtime.create('columns', { settings: { structure } });
            runtime.history.execute({ label: 'Add columns', do: () => runtime.document.insert(columns, { parentId: node.id }), undo: () => runtime.document.remove(columns.id) });
            for (let i = 0; i < count; i += 1) {
                const column = runtime.create('column');
                runtime.history.execute({ label: 'Add column', do: () => runtime.document.insert(column, { parentId: columns.id }), undo: () => runtime.document.remove(column.id) });
            }
            runtime.history.commit();
        } else {
            const existing = node.children || [];
            for (let i = existing.length; i < count; i += 1) {
                const column = runtime.create('column');
                runtime.history.execute({ label: 'Add column', do: () => runtime.document.insert(column, { parentId: node.id }), undo: () => runtime.document.remove(column.id) });
            }
            existing.slice(count).forEach((child) => runtime.remove(child.id));
            runtime.update(node.id, { settings: { structure } }, 'Set structure');
            runtime.history.commit();
        }
    }

    renderControl(control, node) {
        const row = document.createElement('div'); row.className = 'ink-v2-control';
        // Thread the active Normal/Hover/Focus state into state-capable controls.
        if (control.states && control.state !== this.activeState) control = { ...control, state: this.activeState };
        if (control.type !== 'background') {
            const label = document.createElement('label'); label.textContent = control.label;
            if (control.responsive) {
                const switcher = this.renderResponsiveSwitcher(control, node);
                label.appendChild(switcher);
            }
            row.appendChild(label);
        }
        if (control.description && control.type !== 'background') {
            const hint = document.createElement('p'); hint.className = 'ink-v2-control-description'; hint.textContent = control.description;
            row.appendChild(hint);
        }
        const value = this.currentValue(control, node);
        // Composably delegated to the control registry (see EditorRuntime registrations).
        const renderer = this.runtime.controls.has(control.type) ? this.runtime.controls.get(control.type) : null;
        if (renderer) return renderer(this, control, node, value, row);
        let input;
        if (control.type === 'textarea' || control.type === 'code') { input = document.createElement('textarea'); input.value = value; input.classList.toggle('ink-v2-code', control.type === 'code'); }
        else if (['select', 'select2', 'font', 'animation', 'exit-animation', 'hover-animation'].includes(control.type)) {
            input = document.createElement('select');
            (control.options || []).forEach((option) => { const item = document.createElement('option'); item.value = valueFor(option); item.textContent = labelFor(option); input.appendChild(item); }); input.value = value;
        } else if (control.type === 'choose' || control.type === 'visual-choice') {
            input = document.createElement('div'); input.className = 'ink-v2-choose';
            (control.options || []).forEach((option) => {
                const button = document.createElement('button'); button.type = 'button';
                const icon = typeof option === 'object' ? option.icon : null;
                button.innerHTML = icon ? `<span class="material-symbols-rounded" aria-hidden="true">${icon}</span>` : labelFor(option);
                if (!icon) button.textContent = labelFor(option);
                button.className = value === valueFor(option) ? 'is-active' : '';
                button.setAttribute('aria-label', labelFor(option) || String(valueFor(option)));
                button.setAttribute('aria-pressed', value === valueFor(option) ? 'true' : 'false');
                button.addEventListener('click', () => this.setValue(control, node, valueFor(option)));
                input.appendChild(button);
            });
            row.appendChild(input); return row;
        } else if (control.type === 'size') {
            input = document.createElement('div'); input.className = 'ink-v2-size';
            const number = document.createElement('input'); number.type = 'number'; number.value = value && typeof value === 'object' ? value.size ?? '' : '';
            const unit = document.createElement('select'); unit.className = 'ink-v2-unit';
            (control.units || ['px']).forEach((name) => { const option = document.createElement('option'); option.value = name; option.textContent = name; unit.appendChild(option); });
            unit.value = value?.unit || control.units?.[0] || 'px'; input.append(number, unit);
            const commit = () => this.setValue(control, node, number.value === '' ? '' : { size: Number(number.value), unit: unit.value });
            number.addEventListener('change', commit); unit.addEventListener('change', commit);
            row.appendChild(input); return row;
        } else {
            input = document.createElement('input');
            input.type = control.type === 'color' ? 'color' : control.type === 'number' ? 'number' : control.type === 'url' ? 'url' : control.type === 'date-time' ? 'datetime-local' : 'text';
            input.value = value || (control.type === 'color' ? '#000000' : '');
        }
        const commit = () => {
            let next = input.value;
            this.setValue(control, node, next);
        };
        input.addEventListener('change', commit);
        row.appendChild(input);
        if (control.responsive && this.runtime.responsive.device !== 'desktop') {
            const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'ink-v2-inherit'; reset.title = 'Inherit from wider device'; reset.innerHTML = '<span class="material-symbols-rounded">restart_alt</span>'; reset.addEventListener('click', () => this.setValue(control, node, '')); row.appendChild(reset);
        }
        return row;
    }

    renderNavigator() {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-navigator';
        const list = document.createElement('ul');
        const renderNode = (node) => {
            const item = document.createElement('li');
            item.dataset.inkNavigatorItem = node.id;
            const row = document.createElement('div'); row.className = 'ink-v2-navigator-row';
            const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'ink-v2-navigator-toggle'; toggle.textContent = node.children?.length ? (this.collapsedNodes.has(node.id) ? '›' : '⌄') : ''; toggle.disabled = !node.children?.length;
            toggle.addEventListener('click', () => { this.collapsedNodes.has(node.id) ? this.collapsedNodes.delete(node.id) : this.collapsedNodes.add(node.id); this.render(); }); row.appendChild(toggle);
            const button = document.createElement('button'); button.type = 'button'; button.dataset.inkNavigatorId = node.id; button.draggable = true;
            const definition = this.runtime.elements.get(node.type);
            button.innerHTML = `<span class="material-symbols-rounded">${definition.icon}</span><span data-ink-navigator-label>${node.settings.label || node.settings.text || definition.title}</span>`;
            if (node.id === this.runtime.selection.selectedId) button.classList.add('is-active');
            button.addEventListener('click', (event) => { this.runtime.selection.select(node.id, { additive: event.shiftKey || event.metaKey || event.ctrlKey }); this.route = 'navigator'; this.render(); });
            button.addEventListener('dblclick', (event) => { event.preventDefault(); event.stopPropagation(); const label = button.querySelector('[data-ink-navigator-label]'); const input = document.createElement('input'); input.type = 'text'; input.value = node.settings.label || node.settings.text || definition.title; label.replaceWith(input); input.focus(); input.select(); const commit = () => this.runtime.update(node.id, { settings: { label: input.value.trim() } }, 'Rename element'); input.addEventListener('blur', commit, { once: true }); input.addEventListener('keydown', (key) => { if (key.key === 'Enter') input.blur(); if (key.key === 'Escape') this.render(); }); });
            button.addEventListener('dragstart', () => { this.navigatorDragId = node.id; });
            row.appendChild(button);
            if (definition.acceptsChildren) {
                const add = document.createElement('button'); add.type = 'button'; add.className = 'ink-v2-navigator-add'; add.title = 'Add element inside'; add.setAttribute('aria-label', `Add element inside ${definition.title}`); add.innerHTML = '<span class="material-symbols-rounded">add</span>';
                add.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.runtime.selection.select(node.id); this.events.emit('library:open', { parentId: node.id }); if (this.role !== 'navigator') this.route = 'elements'; else this.route = 'navigator'; this.render(); });
                row.appendChild(add);
            }
            row.addEventListener('dragover', (event) => { if (this.navigatorDragId && this.navigatorDragId !== node.id) { event.preventDefault(); row.classList.add('is-drop-target'); } });
            row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
            row.addEventListener('drop', (event) => { event.preventDefault(); row.classList.remove('is-drop-target'); if (!this.navigatorDragId || this.navigatorDragId === node.id) return; const parent = this.runtime.document.parentOf(node.id); const siblings = parent ? parent.children : this.runtime.document.data.children; this.runtime.move(this.navigatorDragId, { parentId: parent?.id || null, index: siblings.findIndex((sibling) => sibling.id === node.id) }); this.navigatorDragId = null; });
            item.appendChild(row);
            if (node.children?.length && !this.collapsedNodes.has(node.id)) { const children = document.createElement('ul'); node.children.forEach((child) => children.appendChild(renderNode(child))); item.appendChild(children); }
            return item;
        };
        this.runtime.document.data.children.forEach((node) => list.appendChild(renderNode(node)));
        wrapper.appendChild(list); return wrapper;
    }

    destroy() { this.unsubscribers.forEach((unsubscribe) => unsubscribe()); this.unsubscribers = []; this.container.replaceChildren(); }
}
