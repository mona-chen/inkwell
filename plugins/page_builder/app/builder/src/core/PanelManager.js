import { pickMedia, uploadMedia } from './MediaPicker.js';
import { resolveLocation } from './StyleValueModel.js';
import { RichTextAdapter } from './RichTextAdapter.js';

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
        this.sectionStates = new Map();
        this.shapeDividerSides = new Map();
        this.collapsedNodes = new Set();
        try { const saved = JSON.parse(localStorage.getItem('inkwell_builder_nav_collapsed') || '[]'); if (Array.isArray(saved)) this.collapsedNodes = new Set(saved); } catch (_) {}
        this.navigatorDragId = null;
        this.unsubscribers = [];
    }

    mount() {
        this.container.classList.add('ink-v2-panel');
        if (this.role === 'settings') this.unsubscribers.push(this.runtime.events.on('selection:change', () => this.render()));
        if (this.role === 'settings') this.unsubscribers.push(this.runtime.events.on('document:update', () => this.render()));
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
        document.addEventListener('click', () => this.closeNavigatorMenu());
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
        const siteParts = section('Site parts');
        const findPart = (key) => {
            let match = null;
            const visit = (node) => { if (!match && node.type === 'site-part' && node.settings?.partKey === key) match = node; (node.children || []).forEach(visit); };
            this.runtime.document.data.children.forEach(visit);
            return match;
        };
        ['header', 'footer'].forEach((key) => {
            const part = findPart(key);
            const canonical = this.runtime.siteParts?.[key];
            const button = document.createElement('button'); button.type = 'button'; button.className = 'ink-v2-site-part-action';
            const status = part ? 'Global · editing updates every assigned page' : canonical ? 'Available globally · add to this page' : 'Create global part';
            button.innerHTML = `<span class="material-symbols-rounded">${key === 'header' ? 'web_asset' : 'bottom_panel'}</span><span><strong>${key[0].toUpperCase()}${key.slice(1)}</strong><small>${status}</small></span><span class="material-symbols-rounded">${part ? 'edit' : 'add'}</span>`;
            // Imported global parts use a display:contents scoping wrapper. Select their first
            // editable child so the canvas can draw a useful outline and expose its native
            // background/layout controls immediately.
            button.addEventListener('click', () => {
                if (part) { this.runtime.selection.select(part.children?.[0]?.id || part.id); return; }
                const overrides = canonical
                    ? { settings: structuredClone(canonical.settings || { partKey: key }), styles: structuredClone(canonical.styles || {}), children: structuredClone(canonical.children || []) }
                    : { settings: { partKey: key }, children: [] };
                const inserted = this.runtime.insert('site-part', { index: key === 'header' ? 0 : this.runtime.document.data.children.length }, overrides);
                this.runtime.siteParts[key] = structuredClone(inserted);
                this.runtime.selection.select(inserted.children?.[0]?.id || inserted.id);
                this.render();
            });
            siteParts.appendChild(button);
        });
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

    renderLibrary() {
        const wrapper = document.createElement('div'); wrapper.className = 'ink-v2-library';
        wrapper.appendChild(this.screenTitle('Elements', 'widgets'));
        const search = document.createElement('input');
        search.type = 'search'; search.className = 'ink-v2-search'; search.placeholder = 'Search elements';
        const groups = document.createElement('div');
        const draw = (query = '') => {
            groups.replaceChildren();
            const definitions = this.runtime.elements.list().filter((definition) => !definition.internal && `${definition.title} ${definition.keywords.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
            const categorized = Map.groupBy ? Map.groupBy(definitions, (definition) => definition.category) : definitions.reduce((map, definition) => map.set(definition.category, [...(map.get(definition.category) || []), definition]), new Map());
            categorized.forEach((items, category) => {
                const section = document.createElement('details'); section.className = 'ink-v2-library-section'; section.open = true;
                section.innerHTML = `<summary><strong>${category}</strong><span class="material-symbols-rounded">expand_more</span></summary><div class="ink-v2-library-grid"></div>`;
                const grid = section.querySelector('.ink-v2-library-grid');
                items.forEach((definition) => {
                    const item = document.createElement('button'); item.type = 'button'; item.className = 'ink-v2-library-item';
                    if (definition.legacy) item.classList.add('is-legacy');
                    item.draggable = true; item.dataset.inkElementType = definition.type;
                    item.innerHTML = `<span class="material-symbols-rounded">${definition.icon}</span><span>${definition.title}</span>${definition.legacy ? '<em>Legacy</em>' : ''}`;
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
            const labels = { content: 'Content', style: 'Style', advanced: 'Advanced', ...(definition.tabLabels || {}) };
            const icons = { content: 'edit', style: 'contrast', advanced: 'settings', ...(definition.tabIcons || {}) };
            const button = document.createElement('button'); button.type = 'button'; button.className = tab === this.activeTab ? 'is-active' : '';
            button.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">${icons[tab]}</span><span>${labels[tab]}</span>`;
            button.addEventListener('click', () => { this.activeTab = tab; this.render(); }); tabs.appendChild(button);
        });
        const controlsHost = wrapper.querySelector('.ink-v2-controls');
        const sections = new Map();
        const tabControls = definition.controls.filter((control) => control.tab === this.activeTab && this.controlIsActive(control, node));
        tabControls.forEach((control) => {
            if (!sections.has(control.section)) {
                const section = document.createElement('details'); section.className = 'ink-v2-control-section'; section.open = control.section !== 'Additional Options'; section.innerHTML = `<summary><span>${control.section}</span><span class="material-symbols-rounded">expand_more</span></summary>`;
                sections.set(control.section, section); controlsHost.appendChild(section);
            }
            const section = sections.get(control.section);
            if (control.states && !section.querySelector('.ink-v2-states')) {
                const available = tabControls.filter((candidate) => candidate.section === control.section && candidate.states).flatMap((candidate) => Array.isArray(candidate.states) ? candidate.states : ['base', 'hover']);
                const stateOptions = [...new Set(available)];
                const active = stateOptions.includes(this.sectionStates.get(control.section)) ? this.sectionStates.get(control.section) : stateOptions[0];
                this.sectionStates.set(control.section, active);
                const states = document.createElement('div'); states.className = 'ink-v2-states'; states.style.setProperty('--ink-state-count', stateOptions.length);
                const labels = { base: 'Normal', hover: 'Hover', focus: 'Focus', active: 'Active' };
                stateOptions.forEach((state) => {
                    const button = document.createElement('button'); button.type = 'button'; button.textContent = labels[state] || state; button.className = active === state ? 'is-active' : '';
                    button.addEventListener('click', () => { this.sectionStates.set(control.section, state); this.render(); }); states.appendChild(button);
                });
                section.appendChild(states);
            }
            const state = control.states ? (this.sectionStates.get(control.section) || 'base') : control.state;
            section.appendChild(this.renderControl(state ? { ...control, state } : control, node));
        });
        return wrapper;
    }

    controlIsActive(control, node) {
        if (!control.condition) return true;
        const test = (conditions) => Object.entries(conditions).every(([name, expected]) => {
            const actual = node.settings[name] ?? node.styles.desktop?.base?.[name] ?? node.styles.base?.[name];
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
        const location = resolveLocation(control, device);
        return node.styles[location.device]?.[location.state]?.[control.name] ?? '';
    }

    setValue(control, node, value) {
        if (control.target === 'settings' || (control.target !== 'styles' && control.tab === 'content')) this.runtime.update(node.id, { settings: { [control.name]: value } }, `Change ${control.label}`);
        else {
            const device = this.runtime.responsive.device;
            const location = resolveLocation(control, device);
            this.runtime.update(node.id, { styles: { [location.device]: { [location.state]: { [control.name]: value } } } }, `Change ${control.label}`);
        }
    }

    mediaValue(control, value, url) {
        return value && typeof value === 'object' && !Array.isArray(value) ? { ...value, url } : url;
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
        if (control.states && !control.state) control = { ...control, state: this.sectionStates.get(control.section) || 'base' };
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
            (control.options || []).forEach((option) => { const item = document.createElement('option'); item.value = valueFor(option); item.textContent = labelFor(option); input.appendChild(item); }); input.value = value !== '' && value !== undefined && value !== null ? value : (control.default ?? '');
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
            input.value = value !== '' && value !== undefined && value !== null ? value : (control.default ?? (control.type === 'color' ? '#000000' : ''));
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
            row.setAttribute('role', 'treeitem'); row.setAttribute('aria-expanded', node.children?.length ? 'true' : 'false');
            const definition = this.runtime.elements.get(node.type);
            const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'ink-v2-navigator-toggle'; toggle.textContent = node.children?.length ? (this.collapsedNodes.has(node.id) ? '›' : '⌄') : ''; toggle.disabled = !node.children?.length;
            toggle.setAttribute('aria-label', node.children?.length ? 'Toggle children' : '');
            toggle.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.toggleNavigatorCollapse(node.id); }); row.appendChild(toggle);
            const button = document.createElement('button'); button.type = 'button'; button.dataset.inkNavigatorId = node.id; button.draggable = true; button.tabIndex = 0;
            button.innerHTML = `<span class="material-symbols-rounded">${definition.icon}</span><span data-ink-navigator-label>${node.settings.label || node.settings.text || definition.title}</span>`;
            if (node.id === this.runtime.selection.selectedId) button.classList.add('is-active');
            if (node.settings.hidden) button.classList.add('is-hidden');
            if (node.settings.locked) button.classList.add('is-locked');
            button.addEventListener('click', (event) => { this.runtime.selection.select(node.id, { additive: event.shiftKey || event.metaKey || event.ctrlKey }); this.route = 'navigator'; this.render(); this.scrollCanvasTo(node.id); });
            button.addEventListener('pointerenter', () => this.runtime.selection.hover(node.id));
            button.addEventListener('pointerleave', () => this.runtime.selection.hover(null));
            button.addEventListener('dblclick', (event) => { event.preventDefault(); event.stopPropagation(); this.renameNavigatorNode(node, button); });
            button.addEventListener('dragstart', () => { this.navigatorDragId = node.id; });
            row.appendChild(button);
            const tools = document.createElement('span'); tools.className = 'ink-v2-navigator-tools';
            if (definition.acceptsChildren) {
                const add = document.createElement('button'); add.type = 'button'; add.className = 'ink-v2-navigator-add'; add.title = 'Add element inside'; add.setAttribute('aria-label', `Add element inside ${definition.title}`); add.innerHTML = '<span class="material-symbols-rounded">add</span>';
                add.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.runtime.selection.select(node.id); this.runtime.events.emit('library:open', { parentId: node.id }); if (this.role !== 'navigator') this.route = 'elements'; else this.route = 'navigator'; this.render(); });
                tools.appendChild(add);
            }
            const visibility = document.createElement('button'); visibility.type = 'button'; visibility.className = 'ink-v2-navigator-vis'; visibility.title = node.settings.hidden ? 'Show element' : 'Hide element'; visibility.setAttribute('aria-label', visibility.title); visibility.innerHTML = `<span class="material-symbols-rounded">${node.settings.hidden ? 'visibility_off' : 'visibility'}</span>`;
            visibility.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.runtime.update(node.id, { settings: { hidden: !node.settings.hidden } }, node.settings.hidden ? 'Show element' : 'Hide element'); });
            tools.appendChild(visibility);
            const lock = document.createElement('button'); lock.type = 'button'; lock.className = 'ink-v2-navigator-lock'; lock.title = node.settings.locked ? 'Unlock element' : 'Lock element'; lock.setAttribute('aria-label', lock.title); lock.innerHTML = `<span class="material-symbols-rounded">${node.settings.locked ? 'lock' : 'lock_open'}</span>`;
            lock.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.runtime.update(node.id, { settings: { locked: !node.settings.locked } }, node.settings.locked ? 'Unlock element' : 'Lock element'); });
            tools.appendChild(lock);
            row.appendChild(tools);
            row.addEventListener('dragover', (event) => this.navigatorDragOver(event, row, node));
            row.addEventListener('dragleave', () => { row.classList.remove('is-drop-target'); delete row.dataset.inkNavDrop; });
            row.addEventListener('drop', (event) => this.navigatorDrop(event, row, node));
            row.addEventListener('contextmenu', (event) => { event.preventDefault(); event.stopPropagation(); this.runtime.selection.select(node.id); this.openNavigatorMenu(event, node, button); });
            item.appendChild(row);
            if (node.children?.length && !this.collapsedNodes.has(node.id)) { const children = document.createElement('ul'); node.children.forEach((child) => children.appendChild(renderNode(child))); item.appendChild(children); }
            return item;
        };
        this.runtime.document.data.children.forEach((node) => list.appendChild(renderNode(node)));
        wrapper.appendChild(list);
        wrapper.setAttribute('role', 'tree');
        wrapper.addEventListener('keydown', (event) => this.navigatorKeydown(event, wrapper));
        return wrapper;
    }

    toggleNavigatorCollapse(id) {
        this.collapsedNodes.has(id) ? this.collapsedNodes.delete(id) : this.collapsedNodes.add(id);
        try { localStorage.setItem('inkwell_builder_nav_collapsed', JSON.stringify([...this.collapsedNodes])); } catch (_) {}
        this.render();
    }

    scrollCanvasTo(id) {
        const canvasEl = this.runtime.canvas.instances.get(id)?.element;
        if (canvasEl) canvasEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    renameNavigatorNode(node, button) {
        const label = button.querySelector('[data-ink-navigator-label]');
        const definition = this.runtime.elements.get(node.type);
        const input = document.createElement('input'); input.type = 'text'; input.value = node.settings.label || node.settings.text || definition.title; label.replaceWith(input); input.focus(); input.select();
        const commit = () => this.runtime.update(node.id, { settings: { label: input.value.trim() } }, 'Rename element');
        input.addEventListener('blur', commit, { once: true });
        input.addEventListener('keydown', (key) => { if (key.key === 'Enter') input.blur(); if (key.key === 'Escape') this.render(); });
    }

    navigatorDragOver(event, row, node) {
        if (!this.navigatorDragId || this.navigatorDragId === node.id) return;
        event.preventDefault(); event.dataTransfer.dropEffect = 'move';
        const rect = row.getBoundingClientRect();
        const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1);
        const position = ratio < .25 ? 'before' : ratio > .75 ? 'after' : 'inside';
        row.dataset.inkNavDrop = position;
        row.classList.add('is-drop-target');
    }

    navigatorDrop(event, row, node) {
        event.preventDefault(); row.classList.remove('is-drop-target');
        const dragId = this.navigatorDragId; this.navigatorDragId = null;
        if (!dragId || dragId === node.id) return;
        const dragNode = this.runtime.document.get(dragId);
        if (!dragNode) return;
        const position = row.dataset.inkNavDrop || 'before';
        delete row.dataset.inkNavDrop;
        // Cannot move a node into itself or a descendant.
        if (dragNode && this.runtime.document.pathTo(node.id).some((ancestor) => ancestor.id === dragId)) return;
        if (position === 'inside') {
            if (!this.runtime.elements.get(node.type).acceptsChildren) return;
            this.runtime.move(dragId, { parentId: node.id, index: node.children?.length || 0 });
        } else {
            const parent = this.runtime.document.parentOf(node.id);
            const siblings = parent ? parent.children : this.runtime.document.data.children;
            const index = siblings.findIndex((sibling) => sibling.id === node.id) + (position === 'after' ? 1 : 0);
            this.runtime.move(dragId, { parentId: parent?.id || null, index });
        }
    }

    openNavigatorMenu(event, node, button) {
        this.closeNavigatorMenu();
        const menu = document.createElement('div'); menu.className = 'ink-navigator-context-menu'; menu.dataset.inkEditorOnly = '';
        const actions = [
            ['edit', 'edit', 'Edit', () => this.runtime.selection.select(node.id)],
            ['duplicate', 'content_copy', 'Duplicate', () => this.runtime.duplicate(node.id)],
            ['copy', 'content_copy', 'Copy', () => this.runtime.copy(node.id)],
            ['paste', 'content_paste', 'Paste', () => this.runtime.paste(node.id)],
            ['rename', 'edit_note', 'Rename', () => this.renameNavigatorNode(node, button)],
            ['delete', 'delete', 'Delete', () => this.runtime.remove(node.id)],
        ];
        actions.forEach(([action, icon, label, run]) => {
            const item = document.createElement('button'); item.type = 'button'; item.dataset.action = action;
            item.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">${icon}</span><span>${label}</span>`;
            item.addEventListener('click', () => { run(); this.closeNavigatorMenu(); });
            menu.appendChild(item);
        });
        document.body.appendChild(menu);
        menu.style.left = `${Math.min(event.clientX, window.innerWidth - 180)}px`;
        menu.style.top = `${Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8)}px`;
        this._navigatorMenu = menu;
    }

    closeNavigatorMenu() { if (this._navigatorMenu) { this._navigatorMenu.remove(); this._navigatorMenu = null; } }

    navigatorKeydown(event, wrapper) {
        if (event.key === 'Escape') { this.closeNavigatorMenu(); return; }
        const rows = Array.from(wrapper.querySelectorAll('[data-ink-navigator-id]'));
        const active = document.activeElement;
        const index = rows.indexOf(active);
        if (index === -1) return;
        if (event.key === 'ArrowDown') { rows[Math.min(index + 1, rows.length - 1)]?.focus(); event.preventDefault(); }
        else if (event.key === 'ArrowUp') { rows[Math.max(index - 1, 0)]?.focus(); event.preventDefault(); }
        else if (event.key === 'Enter') { active.click(); event.preventDefault(); }
        else if (event.key === 'F2') { active.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); event.preventDefault(); }
        else if (event.key === 'Delete' || event.key === 'Backspace') {
            const id = active.dataset.inkNavigatorId;
            if (id) { this.runtime.remove(id); event.preventDefault(); }
        }
    }

    destroy() { this.unsubscribers.forEach((unsubscribe) => unsubscribe()); this.unsubscribers = []; this.container.replaceChildren(); }
}
