import BreakpointCanvasManager from './BreakpointCanvasManager.js';
import CanvasChromeManager from './CanvasChromeManager.js';
import PanelManager from './PanelManager.js';
import { renderIcon } from './icons.js';

const editable = (target) => target?.isContentEditable || target?.closest?.('input,textarea,select,[role="textbox"],.CodeMirror');

// Source-owned workspace coordination. Every design action goes through the live runtime;
// navigation, zoom and panel state never become part of the page document.
export default class StudioManager {
    constructor(builder) { this.builder = builder; this.runtime = builder.runtime; this.tool = 'select'; this.revision = 0; this.savedRevision = 0; this.abort = new AbortController(); this.unsubscribers = []; }

    mount() {
        const host = document.getElementById('LayersContainer');
        if (!host) return this;
        this.layers = new PanelManager({ runtime: this.runtime, container: host, role: 'navigator' }).mount();
        document.querySelectorAll('[data-explorer]').forEach((button) => button.addEventListener('click', () => this.openExplorer(button.dataset.explorer), { signal: this.abort.signal }));
        document.querySelectorAll('[data-studio-insert]').forEach((button) => button.addEventListener('click', () => this.insert(button.dataset.studioInsert), { signal: this.abort.signal }));
        document.querySelector('[data-action="studio-finder"]')?.addEventListener('click', () => this.builder.finder.show(), { signal: this.abort.signal });
        this.openExplorer(this.runtime.document.data.children.length ? 'layers' : 'insert');
        this.builder.breakpoints = new BreakpointCanvasManager(this.builder).mount();
        document.querySelector('[data-studio-breakpoints]')?.addEventListener('click', () => this.builder.breakpoints.setEnabled(!this.builder.breakpoints.enabled), { signal: this.abort.signal });
        this.renderTools();
        this.canvasChrome = new CanvasChromeManager(this.builder).mount();
        this.on('history:change', () => { this.revision++; this.renderSaveStatus(); });
        this.on('frame:draw-end', () => this.setTool('select'));
        this.on('frame:draw', () => this.setTool('frame', false));
        this.on('selection:change', () => { if (!this.runtime.dragDrop.frameDraw && this.tool !== 'comment') this.setTool('select'); });
        this.on('viewport:change', ({ scale }) => {
            this.zoomLabel.textContent = `${Math.round(scale * 100)}%`;
            if (this.zoomInput) this.zoomInput.value = Math.round(scale * 100);
        });
        this.on('editor:mode', ({ mode }) => { this.setTool('select'); this.toolbar.hidden = mode !== 'design'; });
        ['customCss', 'customJs'].forEach((id) => document.getElementById(id)?.addEventListener('input', () => { this.revision++; this.renderSaveStatus(); }, { signal: this.abort.signal }));
        this.builder.iframeDoc.addEventListener('keyup', (event) => this.releaseSpace(event), { signal: this.abort.signal });
        document.addEventListener('keyup', (event) => this.releaseSpace(event), { signal: this.abort.signal });
        window.addEventListener('blur', () => this.releaseSpace({ code: 'Space' }), { signal: this.abort.signal });
        return this;
    }

    on(name, handler) { this.unsubscribers.push(this.runtime.events.on(name, handler)); }

    destroy() {
        this.abort.abort(); this.unsubscribers.forEach((off) => off()); this.unsubscribers = [];
        this.canvasChrome?.destroy(); this.layers?.destroy(); this.toolbar?.remove();
    }

    openExplorer(screen) {
        this.screen = screen;
        const layers = document.getElementById('LayersContainer');
        const library = document.getElementById('WidgetsContainer');
        if (!layers || !library) return;
        layers.hidden = screen !== 'layers'; library.hidden = screen === 'layers'; library.style.display = screen === 'layers' ? 'none' : '';
        if (['page', 'insert', 'history'].includes(screen)) { this.runtime.panel.route = screen === 'page' ? 'site' : screen === 'insert' ? 'elements' : 'history'; this.runtime.panel.render(); }
        document.querySelectorAll('[data-explorer]').forEach((button) => {
            const active = button.dataset.explorer === screen;
            button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
        });
    }

    renderTools() {
        this.toolbar = document.createElement('div'); this.toolbar.className = 'ink-canvas-toolbar'; this.toolbar.setAttribute('role', 'toolbar'); this.toolbar.setAttribute('aria-label', 'Canvas tools');
        const button = (label, icon, action, tool) => {
            const el = document.createElement('button'); el.type = 'button'; el.title = label; el.setAttribute('aria-label', label);
            el.appendChild(renderIcon(document, `lucide:${icon}`, 'ink-studio-icon'));
            if (tool) { el.dataset.studioTool = tool; el.setAttribute('aria-pressed', String(tool === this.tool)); }
            el.addEventListener('click', action); this.toolbar.appendChild(el); return el;
        };
        button('Select (V)', 'mouse-pointer-2', () => this.setTool('select'), 'select');
        button('Pan (H · hold Space)', 'hand', () => this.setTool('hand'), 'hand');
        this.toolbar.appendChild(document.createElement('hr'));
        button('Comment (C)', 'message-circle', () => this.setTool('comment'), 'comment');
        this.zoomLabel = document.createElement('button'); this.zoomLabel.type = 'button'; this.zoomLabel.className = 'ink-studio-zoom'; this.zoomLabel.textContent = '100%'; this.zoomLabel.title = 'Zoom options'; this.zoomLabel.setAttribute('aria-label', 'Zoom options'); this.zoomLabel.setAttribute('aria-expanded', 'false');
        this.zoomLabel.addEventListener('click', () => { this.zoomMenu.hidden = !this.zoomMenu.hidden; this.zoomLabel.setAttribute('aria-expanded', String(!this.zoomMenu.hidden)); if (!this.zoomMenu.hidden) { this.zoomInput.value = Math.round(this.builder.viewport.scale * 100); this.zoomInput.focus(); this.zoomInput.select(); } }); this.toolbar.appendChild(this.zoomLabel);
        this.zoomMenu = document.createElement('div'); this.zoomMenu.className = 'ink-studio-zoom-menu'; this.zoomMenu.hidden = true;
        this.zoomInput = document.createElement('input'); this.zoomInput.type = 'number'; this.zoomInput.min = 10; this.zoomInput.max = 400; this.zoomInput.setAttribute('aria-label', 'Zoom percentage');
        const closeZoom = () => { this.zoomMenu.hidden = true; this.zoomLabel.setAttribute('aria-expanded', 'false'); };
        const setZoom = () => { if (this.zoomInput.value !== '') this.builder.viewport.setScale(Number(this.zoomInput.value) / 100); closeZoom(); };
        this.zoomInput.addEventListener('change', setZoom);
        this.zoomInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); setZoom(); } if (event.key === 'Escape') closeZoom(); });
        const label = document.createElement('label'); label.textContent = 'Zoom %'; label.appendChild(this.zoomInput); this.zoomMenu.appendChild(label);
        [['Zoom in (+)', () => this.builder.viewport.setScale(this.builder.viewport.scale * 1.2)], ['Zoom out (−)', () => this.builder.viewport.setScale(this.builder.viewport.scale / 1.2)], ['Zoom to selection (Shift + 2)', () => this.builder.viewport.focusSelection()], ['Fit canvas', () => this.builder.viewport.fitScale()], ['100%', () => this.builder.viewport.setScale(1)], ['200%', () => this.builder.viewport.setScale(2)]].forEach(([text, action]) => {
            const option = document.createElement('button'); option.type = 'button'; option.textContent = text; option.addEventListener('click', () => { action(); closeZoom(); }); this.zoomMenu.appendChild(option);
        });
        this.toolbar.appendChild(this.zoomMenu);
        document.addEventListener('pointerdown', (event) => { if (!this.zoomMenu.contains(event.target) && !this.zoomLabel.contains(event.target)) closeZoom(); }, { signal: this.abort.signal });
        document.querySelector('.ink-canvas-stage').appendChild(this.toolbar);
        this.setTool('select');
    }

    setTool(tool, arm = true) {
        this.tool = tool;
        this.builder.collaboration?.setCommentMode(tool === 'comment');
        if (tool !== 'frame') this.runtime.dragDrop.cancelFrameDraw();
        if (tool === 'frame' && arm) this.runtime.panel.insertDefinition('frame');
        this.builder.viewport.setPanMode(tool === 'hand' || this.spaceHeld);
        this.toolbar?.querySelectorAll('[data-studio-tool]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.studioTool === tool)));
    }

    insert(type) {
        if (this.builder.mode !== 'design') return;
        this.runtime.panel.insertionParentId = null;
        this.runtime.panel.insertDefinition(type);
        if (type !== 'frame') this.setTool('select');
    }

    releaseSpace(event) {
        if (event.code !== 'Space' || !this.spaceHeld) return;
        this.spaceHeld = false; this.builder.viewport.setPanMode(this.tool === 'hand');
    }

    onKeyDown(event) {
        if (editable(event.target) || event.defaultPrevented || this.builder.mode !== 'design' || !this.builder.finder.dialog.hidden || !this.builder.hotkeys.hidden) return false;
        const command = event.metaKey || event.ctrlKey, key = event.key.toLowerCase();
        if (command && key === 's') { event.preventDefault(); this.saveDraft(); return true; }
        if (command || event.altKey) return false;
        if (event.key.startsWith('Arrow') && this.nudge(event.key, event.shiftKey ? 10 : 1)) { event.preventDefault(); return true; }
        let action;
        if (event.code === 'Space') action = () => { this.spaceHeld = true; this.builder.viewport.setPanMode(true); };
        else if (key === 'v' || key === 'escape') action = () => this.setTool('select');
        else if (key === 'c') action = () => this.setTool('comment');
        else if (key === 'h') action = () => this.setTool('hand');
        else if (key === 'f') action = () => this.insert('frame');
        else if (key === 't') action = () => this.insert('heading');
        else if (key === 'i') action = () => this.builder.openPanelScreen('elements', { preserveSelection: true });
        else if (event.shiftKey && (event.code === 'Digit1' || key === '!')) action = () => this.builder.viewport.fitScale();
        else if (event.shiftKey && (event.code === 'Digit2' || key === '@')) action = () => this.builder.viewport.focusSelection();
        else if (key === '0') action = () => this.builder.viewport.setScale(1);
        else if (key === '+' || key === '=') action = () => this.builder.viewport.setScale(this.builder.viewport.scale * 1.2);
        else if (key === '-') action = () => this.builder.viewport.setScale(this.builder.viewport.scale / 1.2);
        if (!action) return false;
        event.preventDefault(); if (!event.repeat) action();
        return key !== 'escape';
    }

    nudge(key, distance) {
        const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
        const sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
        const ids = [...this.runtime.selection.selectedIds];
        const changes = ids.filter((id) => !this.runtime.document.pathTo(id).slice(0, -1).some((node) => ids.includes(node.id))).map((id) => {
            const node = this.runtime.document.get(id), element = this.runtime.canvas.instances.get(id)?.element;
            if (!node || node.settings.locked || !element) return null;
            const style = element.ownerDocument.defaultView.getComputedStyle(element);
            if (!['absolute', 'fixed'].includes(style.position)) return null;
            const primary = horizontal ? 'left' : 'top', opposite = horizontal ? 'right' : 'bottom';
            const side = style[primary] === 'auto' ? opposite : primary;
            const value = (parseFloat(style[side]) || 0) + distance * sign * (side === primary ? 1 : -1);
            return { id, before: structuredClone(node.styles), patch: { [this.runtime.responsive.device]: { base: { [side]: { size: value, unit: 'px' } } } } };
        }).filter(Boolean);
        if (!changes.length) return false;
        this.runtime.history.execute({ label: 'Nudge selection',
            do: () => changes.forEach(({ id, patch }) => this.runtime.document.update(id, { styles: patch })),
            undo: () => changes.forEach(({ id, before }) => { const node = this.runtime.document.get(id); if (node) { node.styles = structuredClone(before); this.runtime.events.emit('document:update', { id, patch: { styles: before } }); } }),
        });
        return true;
    }

    renderSaveStatus(state) {
        const status = document.querySelector('[data-save-status]');
        if (status) status.textContent = state || (this.revision === this.savedRevision ? 'Saved' : 'Save draft');
        document.getElementById('draftSaveButton')?.classList.toggle('is-unsaved', this.revision !== this.savedRevision);
    }

    async saveDraft() {
        if (this.saving || typeof window.persistBuilderDocument !== 'function') return;
        window.applyCustomCode?.();
        const revision = this.revision; this.saving = true; this.renderSaveStatus('Saving…');
        const button = document.getElementById('draftSaveButton'); if (button) button.disabled = true;
        try {
            const payload = await window.persistBuilderDocument(false);
            if (payload.preview_url) window.previewPageUrl = payload.preview_url;
            this.savedRevision = revision; this.renderSaveStatus();
            return payload;
        } catch (error) { this.renderSaveStatus('Retry save'); console.error(error); }
        finally { this.saving = false; if (button) button.disabled = false; }
    }
}
