import { pickMedia, uploadMedia } from './MediaPicker.js';
import { resolveLocation } from './StyleValueModel.js';
import { RichTextAdapter } from './RichTextAdapter.js';
import { availableFonts } from './fonts.js';
import { renderIcon } from './icons.js';
import { lucideName } from './editorIcons.js';
import { DEFAULT_THEME_COLORS, DEFAULT_THEME_TYPOGRAPHY } from './themeDefaults.js';

const labelFor = (option) => typeof option === 'object' ? option.label : String(option).replace(/-/g, ' ');
const valueFor = (option) => typeof option === 'object' ? option.value : option;

// Capture the identity + value of the control input the user is actively editing, so a live
// document:update re-render can hand the keyboard back to the same control instead of dropping
// it and scrolling the panel to the top.
const captureFocusState = (body) => {
    const el = body?.ownerDocument?.activeElement;
    if (!el || !body?.contains(el)) return null;
    const row = el.closest?.('.ink-v2-control[data-ink-control]');
    if (!row) return null;
    const control = row.dataset.inkControl;
    const section = row.closest?.('details[data-section]')?.dataset.section || '';
    const value = (el.value !== undefined && el.value !== null) ? String(el.value) : null;
    const caret = (el.selectionStart != null) ? el.selectionStart : null;
    return { control, section, value, caret, type: el.type };
};

const restoreFocusState = (body, state) => {
    if (!state?.control) return;
    let row = body.querySelector(`.ink-v2-control[data-ink-control="${CSS.escape(state.control)}"]`);
    if (!row && state.section) {
        const sectionEl = body.querySelector(`details[data-section="${CSS.escape(state.section)}"]`);
        if (sectionEl) sectionEl.open = true;
    }
    if (!row) return;
    const input = row.querySelector('input, select, textarea');
    if (!input || (state.value !== null && String(input.value) !== state.value)) return;
    input.focus();
    if (state.caret != null && typeof input.setSelectionRange === 'function') { try { input.setSelectionRange(state.caret, state.caret); } catch (_) {} }
};


export default class PanelManager {
    constructor({ runtime, container, role = 'main' } = {}) {
        this.runtime = runtime;
        this.container = container;
        this.role = role; // 'main' (left panel: elements/site/history) | 'settings' | 'navigator' (Navigator window)
        this.route = role === 'settings' ? 'settings' : role === 'navigator' ? 'navigator' : 'elements';
        this.activeTab = 'content';
        this.activeState = 'base'; // 'base' | 'hover' | 'focus' (Elementor Normal/Hover/Focus)
        this.sectionStates = new Map();
        this.shapeDividerSides = new Map();
        // Opening the library from a container establishes an insertion context. Keep it
        // while the user adds several children; selecting the first inserted child must not
        // silently send the next element back to the document root.
        this.insertionParentId = null;
        // Navigator branches are closed by default. Persist only the smaller, intentional set
        // of branches the user opened, matching layer panels in design tools.
        this.expandedNodes = new Set();
        try { const saved = JSON.parse(localStorage.getItem('inkwell_builder_nav_expanded') || '[]'); if (Array.isArray(saved)) this.expandedNodes = new Set(saved); } catch (_) {}
        this.navigatorDragId = null;
        this.unsubscribers = [];
    }

    mount() {
        this.container.classList.add('ink-v2-panel');
        if (this.role === 'settings') this.unsubscribers.push(this.runtime.events.on('selection:change', () => this.render()));
        if (this.role === 'settings') this.unsubscribers.push(this.runtime.events.on('document:update', () => this.render()));
        if (this.role === 'settings') this.unsubscribers.push(this.runtime.events.on('element:position-preview', ({ id, values }) => {
            if (id !== this.runtime.selection.selectedId) return;
            Object.entries(values || {}).forEach(([side, value]) => {
                const field = this.container.querySelector(`.ink-v2-position-pins [data-side="${side}"]`);
                const input = field?.querySelector('input'); const unit = field?.querySelector('select');
                if (input) input.value = value?.size ?? '';
                if (unit && value?.unit) unit.value = value.unit;
            });
        }));
        if (this.role === 'navigator') this.unsubscribers.push(this.runtime.events.on('selection:change', () => { this.revealNavigatorSelection(); this.render(); }));
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
        this.unsubscribers.push(this.runtime.events.on('library:open', ({ parentId = null } = {}) => {
            if (this.role !== 'main') return;
            this.insertionParentId = parentId;
            this.route = 'elements';
            this.render();
        }));
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

    render({ preserveScroll = true, restoreFocus = true } = {}) {
        // A live control edit (type/click in Scale, Radius, Rotate, …) fires document:update,
        // which re-runs render() and would otherwise wipe the scroll container (replaceChildren)
        // and jolt the panel back to the top. Capture the previous scroll position and the
        // focused control's identity + value first, then re-apply them after the rebuild so
        // editing deep in the Advanced tab stays put and the control keeps the keyboard.
        const priorBody = this.container.querySelector('.ink-v2-panel-body');
        const priorScrollTop = preserveScroll ? priorBody?.scrollTop || 0 : 0;
        const priorFocus = restoreFocus ? captureFocusState(priorBody) : null;
        this.container.replaceChildren();
        const body = document.createElement('div');
        body.className = 'ink-v2-panel-body';
        if (this.route === 'elements') body.appendChild(this.renderLibrary());
        if (this.route === 'settings') body.appendChild(this.renderSettings());
        if (this.route === 'navigator') body.appendChild(this.renderNavigator());
        if (this.route === 'site') body.appendChild(this.renderSiteSettings());
        if (this.route === 'history') body.appendChild(this.renderHistory());
        this.container.appendChild(body);
        if (preserveScroll && priorBody) body.scrollTop = priorScrollTop;
        if (restoreFocus && priorFocus) restoreFocusState(body, priorFocus);
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
        Object.entries(DEFAULT_THEME_COLORS).forEach(([name, fallback]) => field(colors, name[0].toUpperCase() + name.slice(1), theme.colors?.[name] || fallback, 'color', (value) => this.updateTheme('colors', name, value)));
        const typography = section('Global typography');
        field(typography, 'Font family', theme.typography?.fontFamily || DEFAULT_THEME_TYPOGRAPHY.fontFamily, 'select', (value) => this.updateTheme('typography', 'fontFamily', value), ['Inter,ui-sans-serif,system-ui,sans-serif', 'Roboto,Arial,sans-serif', 'Georgia,serif', 'ui-monospace,SFMono-Regular,monospace', ...availableFonts(this.runtime.document)]);
        field(typography, 'Base font size', theme.typography?.baseSize || DEFAULT_THEME_TYPOGRAPHY.baseSize, 'number', (value) => this.updateTheme('typography', 'baseSize', value));
        field(typography, 'Line height', theme.typography?.lineHeight || DEFAULT_THEME_TYPOGRAPHY.lineHeight, 'number', (value) => this.updateTheme('typography', 'lineHeight', value));
        const customFontSection = section('Custom fonts');
        const customFonts = Array.isArray(settings.customFonts) ? settings.customFonts : [];
        const updateCustomFont = (index, changes) => {
            const next = structuredClone(customFonts);
            next[index] = { ...(next[index] || {}), ...changes };
            this.runtime.updateDocumentSettings({ customFonts: next }, 'Update custom font');
        };
        customFonts.forEach((font, index) => {
            const card = document.createElement('div'); card.className = 'ink-v2-custom-font';
            field(card, 'Family', font.family || '', 'text', (value) => updateCustomFont(index, { family: value }));
            field(card, 'WOFF2 URL', font.url || '', 'url', (value) => updateCustomFont(index, { url: value }));
            field(card, 'Weight', font.weight || '400', 'text', (value) => updateCustomFont(index, { weight: value }));
            field(card, 'Style', font.style || 'normal', 'select', (value) => updateCustomFont(index, { style: value }), ['normal', 'italic', 'oblique']);
            field(card, 'Loading', font.display || 'swap', 'select', (value) => updateCustomFont(index, { display: value }), ['swap', 'block', 'fallback', 'optional', 'auto']);
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'ink-v2-custom-font-remove'; remove.textContent = 'Remove font';
            remove.addEventListener('click', () => {
                const next = structuredClone(customFonts); next.splice(index, 1);
                this.runtime.updateDocumentSettings({ customFonts: next }, 'Remove custom font');
            });
            card.appendChild(remove); customFontSection.appendChild(card);
        });
        const addFont = document.createElement('button'); addFont.type = 'button'; addFont.className = 'ink-v2-site-part-action ink-v2-add-custom-font';
        addFont.innerHTML = '<span class="material-symbols-rounded">font_download</span><span><strong>Add custom font</strong><small>Register a WOFF2 file for typography controls and published pages</small></span>';
        addFont.addEventListener('click', () => this.runtime.updateDocumentSettings({ customFonts: [...customFonts, { family: 'Custom font', url: '', weight: '400', style: 'normal', display: 'swap' }] }, 'Add custom font'));
        customFontSection.appendChild(addFont);
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
            const definitions = this.runtime.elements.list().filter((definition) => !definition.internal && !definition.legacy && `${definition.title} ${definition.keywords.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
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
        const preferredParent = this.insertionParentId && this.runtime.document.get(this.insertionParentId);
        let target = preferredParent && this.runtime.elements.accepts(preferredParent, candidate) ? { parentId: preferredParent.id } : null;
        if (!target && selected && this.runtime.elements.accepts(selected, candidate)) target = { parentId: selected.id };
        if (!target && selected) {
            const parent = this.runtime.document.parentOf(selected.id);
            if (parent && this.runtime.elements.accepts(parent, candidate)) {
                const index = parent.children.findIndex((child) => child.id === selected.id) + 1;
                target = { parentId: parent.id, index };
            }
        }
        // Frames are drawn, rather than immediately dropped as anonymous empty boxes. This
        // keeps normal document insertion for every other element while giving authors the
        // deliberate freeform composition workflow they expect from a Frame.
        if (type === 'frame') {
            this.runtime.events.emit('frame:draw', { parentId: target?.parentId || null });
            return;
        }
        const node = this.runtime.insert(type, target || {}, overrides);
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
        const selectedCount = this.runtime.selection.selectedIds.size;
        const titleSuffix = selectedCount > 1 ? ` <small style="opacity:.6">(${selectedCount})</small>` : '';
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<div class="ink-v2-element-title"><button type="button" data-back aria-label="Back to elements"><span class="material-symbols-rounded">arrow_back</span></button><span class="ink-v2-edit-label">Edit</span><strong>${definition.title}${titleSuffix}</strong></div><div class="ink-v2-control-tabs"></div><div class="ink-v2-controls"></div>`;
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
                const section = document.createElement('details'); section.className = 'ink-v2-control-section'; section.dataset.section = String(control.section || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'); section.open = control.section !== 'Additional Options'; section.innerHTML = `<summary><span>${control.section}</span><span class="ink-v2-section-chevron" aria-hidden="true">⌄</span></summary>`;
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
        const explicit = node.styles[location.device]?.[location.state]?.[control.name];
        if (explicit !== undefined && explicit !== null && explicit !== '') return explicit;
        // Responsive values cascade exactly like the generated CSS. Showing the inherited
        // value prevents a tablet/mobile control from looking unset while the canvas visibly
        // uses its wider-breakpoint value. Resetting still stores an empty override.
        if (control.responsive && location.device !== 'desktop') {
            const widerDevices = location.device === 'mobile' ? ['tablet', 'desktop'] : ['desktop'];
            for (const wider of widerDevices) {
                const inherited = node.styles[wider]?.[location.state]?.[control.name];
                if (inherited !== undefined && inherited !== null && inherited !== '') return inherited;
            }
        }
        return '';
    }

    setValue(control, node, value) {
        const live = this.runtime.document.get(node.id);
        if (!live) return;
        // Batch edit: when multiple elements are selected, apply to all that share
        // the same element type (so button-specific controls don't accidentally apply
        // to a heading).
        const ids = [...this.runtime.selection.selectedIds];
        const targets = ids.length > 1
            ? ids.map((id) => this.runtime.document.get(id)).filter((n) => n && n.type === node.type)
            : [node];
        targets.forEach((target) => {
            if (control.target === 'settings' || (control.target !== 'styles' && control.tab === 'content')) {
                this.runtime.update(target.id, { settings: { [control.name]: value } }, `Change ${control.label}`);
            } else {
                const device = this.runtime.responsive.device;
                const location = resolveLocation(control, device);
                this.runtime.update(target.id, { styles: { [location.device]: { [location.state]: { [control.name]: value } } } }, `Change ${control.label}`);
            }
        });
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
        // Stable identifier so render() can restore focus to the same control after a live edit.
        row.dataset.inkControl = String(control.name || control.label || '').replace(/[^a-z0-9-]+/gi, '-');
        // Thread the active Normal/Hover/Focus state into state-capable controls.
        if (control.states && !control.state) control = { ...control, state: this.sectionStates.get(control.section) || 'base' };
        if (control.type !== 'background' && !control.hideLabel) {
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
            input = document.createElement('div'); input.className = 'ink-v2-choose'; input.setAttribute('role', 'radiogroup'); input.setAttribute('aria-label', control.label || 'Choose an option');
            (control.options || []).forEach((option) => {
                const button = document.createElement('button'); button.type = 'button';
                const icon = typeof option === 'object' ? option.icon : null;
                button.innerHTML = icon ? `<span class="material-symbols-rounded" aria-hidden="true">${icon}</span>` : labelFor(option);
                if (!icon) button.textContent = labelFor(option);
                button.className = value === valueFor(option) ? 'is-active' : '';
                button.setAttribute('aria-label', labelFor(option) || String(valueFor(option)));
                button.setAttribute('role', 'radio'); button.setAttribute('aria-checked', value === valueFor(option) ? 'true' : 'false');
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
            number.addEventListener('change', commit);
            number.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                commit();
                number.blur();
            });
            unit.addEventListener('change', commit);
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
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' || input.tagName === 'TEXTAREA') return;
            event.preventDefault();
            commit();
            input.blur();
        });
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
            row.setAttribute('role', 'treeitem');
            if (node.children?.length) row.setAttribute('aria-expanded', this.expandedNodes.has(node.id) ? 'true' : 'false');
            const definition = this.runtime.elements.get(node.type);
            const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'ink-v2-navigator-toggle'; toggle.textContent = node.children?.length ? (this.expandedNodes.has(node.id) ? '⌄' : '›') : ''; toggle.disabled = !node.children?.length;
            toggle.setAttribute('aria-label', node.children?.length ? 'Toggle children' : '');
            toggle.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.toggleNavigatorCollapse(node.id); }); row.appendChild(toggle);
            const button = document.createElement('button'); button.type = 'button'; button.dataset.inkNavigatorId = node.id; button.draggable = true; button.tabIndex = 0;
            const elementIcon = renderIcon(document, `lucide:${lucideName(definition.icon)}`, 'ink-v2-navigator-icon');
            const elementLabel = document.createElement('span'); elementLabel.dataset.inkNavigatorLabel = ''; elementLabel.textContent = node.settings.label || node.settings.text || definition.title;
            button.append(elementIcon, elementLabel);
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
            const visibility = document.createElement('button'); visibility.type = 'button'; visibility.className = 'ink-v2-navigator-vis'; visibility.title = node.settings.hidden ? 'Show element' : 'Hide element'; visibility.setAttribute('aria-label', visibility.title); visibility.appendChild(renderIcon(document, `lucide:${node.settings.hidden ? 'eye-off' : 'eye'}`, 'ink-v2-navigator-icon'));
            visibility.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.runtime.update(node.id, { settings: { hidden: !node.settings.hidden } }, node.settings.hidden ? 'Show element' : 'Hide element'); });
            tools.appendChild(visibility);
            const lock = document.createElement('button'); lock.type = 'button'; lock.className = 'ink-v2-navigator-lock'; lock.title = node.settings.locked ? 'Unlock element' : 'Lock element'; lock.setAttribute('aria-label', lock.title); lock.appendChild(renderIcon(document, `lucide:${node.settings.locked ? 'lock' : 'unlock'}`, 'ink-v2-navigator-icon'));
            lock.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.runtime.update(node.id, { settings: { locked: !node.settings.locked } }, node.settings.locked ? 'Unlock element' : 'Lock element'); });
            tools.appendChild(lock);
            row.appendChild(tools);
            row.addEventListener('dragover', (event) => this.navigatorDragOver(event, row, node));
            row.addEventListener('dragleave', () => { row.classList.remove('is-drop-target'); delete row.dataset.inkNavDrop; });
            row.addEventListener('drop', (event) => this.navigatorDrop(event, row, node));
            row.addEventListener('contextmenu', (event) => {
                event.preventDefault(); event.stopPropagation();
                // Preserve an existing multi-selection when opening its context menu so the
                // user can group those layers just like in a design tool.
                if (!this.runtime.selection.selectedIds.has(node.id)) this.runtime.selection.select(node.id);
                this.openNavigatorMenu(event, node, button);
            });
            item.appendChild(row);
            if (node.children?.length && this.expandedNodes.has(node.id)) { const children = document.createElement('ul'); node.children.forEach((child) => children.appendChild(renderNode(child))); item.appendChild(children); }
            return item;
        };
        this.runtime.document.data.children.forEach((node) => list.appendChild(renderNode(node)));
        wrapper.appendChild(list);
        wrapper.setAttribute('role', 'tree');
        wrapper.addEventListener('keydown', (event) => this.navigatorKeydown(event, wrapper));
        return wrapper;
    }

    toggleNavigatorCollapse(id) {
        this.expandedNodes.has(id) ? this.expandedNodes.delete(id) : this.expandedNodes.add(id);
        this.persistNavigatorExpansion();
        this.render();
    }

    revealNavigatorSelection() {
        const selectedId = this.runtime.selection.selectedId;
        if (!selectedId) return;
        const path = this.runtime.document.pathTo(selectedId) || [];
        path.slice(0, -1).forEach((ancestor) => this.expandedNodes.add(ancestor.id));
        this.persistNavigatorExpansion();
    }

    persistNavigatorExpansion() {
        try { localStorage.setItem('inkwell_builder_nav_expanded', JSON.stringify([...this.expandedNodes])); } catch (_) {}
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
        const selectedIds = [...this.runtime.selection.selectedIds];
        const canGroup = this.runtime.canGroupSelection(selectedIds);
        const actions = [
            ['edit', 'edit', 'Edit', () => this.runtime.selection.select(node.id)],
            ...(canGroup ? [['frame', 'crop', 'Frame selected layers', () => this.runtime.frameSelection(selectedIds)]] : []),
            ...(node.type === 'frame' && node.settings?.frameSelection ? [['unframe', 'ungroup', 'Unframe', () => this.runtime.unframe(node.id)]] : []),
            ...(canGroup ? [['group', 'group', 'Group selected layers', () => this.runtime.groupSelection(selectedIds)]] : []),
            ...(node.type === 'group' && node.settings?.grouping ? [['ungroup', 'ungroup', 'Ungroup', () => this.runtime.ungroup(node.id)]] : []),
            ['duplicate', 'content_copy', 'Duplicate', () => this.runtime.duplicate(node.id)],
            ['copy', 'content_copy', 'Copy', () => this.runtime.copy(node.id)],
            ['paste', 'content_paste', 'Paste', () => this.runtime.paste(node.id)],
            ['rename', 'edit_note', 'Rename', () => this.renameNavigatorNode(node, button)],
            ['delete', 'delete', 'Delete', () => this.runtime.remove(node.id)],
        ];
        actions.forEach(([action, icon, label, run]) => {
            const item = document.createElement('button'); item.type = 'button'; item.dataset.action = action;
            const actionIcon = renderIcon(document, `lucide:${lucideName(icon)}`, 'ink-v2-navigator-icon');
            const actionLabel = document.createElement('span'); actionLabel.textContent = label;
            item.append(actionIcon, actionLabel);
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
