import { renderIcon } from './icons.js';

// Screen-space labels and actions remain legible at every zoom. Resize / rotate gestures
// still belong to the runtime's iframe overlays and history, not a second document model.
export default class CanvasChromeManager {
    constructor(builder) { this.builder = builder; this.runtime = builder.runtime; this.unsubscribers = []; }
    mount() {
        this.stage = document.querySelector('.ink-canvas-stage');
        this.host = document.createElement('div'); this.host.className = 'ink-canvas-chrome'; this.host.hidden = true;
        this.label = document.createElement('button'); this.label.type = 'button'; this.label.className = 'ink-canvas-selection-label'; this.label.title = 'Reveal selection in Layers';
        this.label.draggable = true;
        this.label.addEventListener('dragstart', (event) => { const id = this.runtime.selection.selectedId; if (id && !this.runtime.document.get(id)?.settings.locked) this.runtime.dragDrop.beginDrag({ id }, event, document); else event.preventDefault(); });
        this.label.addEventListener('click', () => { this.builder.studio.openExplorer('layers'); this.builder.studio.layers.revealNavigatorSelection(); this.builder.studio.layers.render(); });
        this.size = document.createElement('span'); this.size.className = 'ink-canvas-selection-size';
        this.actions = document.createElement('div'); this.actions.className = 'ink-canvas-selection-actions'; this.actions.setAttribute('role', 'toolbar'); this.actions.setAttribute('aria-label', 'Selection actions');
        [['parent', 'arrow-up', 'Select parent'], ['duplicate', 'copy', 'Duplicate selection'], ['delete', 'trash-2', 'Delete selection']].forEach(([action, icon, title]) => {
            const button = document.createElement('button'); button.type = 'button'; button.title = title; button.setAttribute('aria-label', title); button.dataset.selectionAction = action;
            button.appendChild(renderIcon(document, `lucide:${icon}`, 'ink-studio-icon'));
            button.addEventListener('click', () => {
                const id = this.runtime.selection.selectedId;
                if (action === 'parent') this.runtime.selection.select(this.runtime.document.parentOf(id)?.id || null);
                if (action === 'duplicate') this.runtime.duplicate(id);
                if (action === 'delete') this.runtime.removeMany(this.runtime.selection.selectedIds);
            }); this.actions.appendChild(button);
        });
        this.host.append(this.label, this.size, this.actions); this.stage.appendChild(this.host);
        this.schedule = () => { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = null; this.render(); }); };
        ['selection:change', 'canvas:render', 'viewport:change', 'editor:mode'].forEach((event) => this.unsubscribers.push(this.runtime.events.on(event, this.schedule)));
        this.observer = new MutationObserver(this.schedule); this.observer.observe(this.builder.iframeDoc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
        this.builder.iframeDoc.addEventListener('scroll', this.schedule, true);
        this.render(); return this;
    }
    render() {
        const selected = [...this.runtime.selection.selectedIds].map((id) => ({ node: this.runtime.document.get(id), element: this.runtime.canvas.instances.get(id)?.element })).filter(({ node, element }) => node && element);
        this.host.hidden = !selected.length || this.builder.mode !== 'design'; if (this.host.hidden) return;
        const boxes = selected.map(({ element }) => element.getBoundingClientRect());
        const left = Math.min(...boxes.map((rect) => rect.left)), top = Math.min(...boxes.map((rect) => rect.top));
        const right = Math.max(...boxes.map((rect) => rect.right)), bottom = Math.max(...boxes.map((rect) => rect.bottom));
        const stage = this.stage.getBoundingClientRect(), iframe = this.builder.iframe.getBoundingClientRect(), scale = this.builder.viewport.scale;
        const x = iframe.left - stage.left + left * scale, y = iframe.top - stage.top + top * scale, width = (right - left) * scale, height = (bottom - top) * scale;
        this.host.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px`;
        const node = selected.at(-1).node;
        this.label.textContent = selected.length > 1 ? `${selected.length} layers` : node.settings.label || this.runtime.elements.get(node.type).title;
        this.size.textContent = `${Math.round(right - left)} × ${Math.round(bottom - top)}`;
        this.actions.querySelector('[data-selection-action="parent"]').disabled = !this.runtime.document.parentOf(node.id);
        this.actions.querySelector('[data-selection-action="duplicate"]').disabled = selected.length > 1 || node.settings.locked;
        this.actions.querySelector('[data-selection-action="delete"]').disabled = selected.some(({ node: layer }) => layer.settings.locked);
        this.actions.hidden = selected.length > 1 || width < 260;
        this.host.classList.toggle('is-multiple', selected.length > 1);
    }
    destroy() { cancelAnimationFrame(this.frame); this.observer?.disconnect(); this.builder.iframeDoc.removeEventListener('scroll', this.schedule, true); this.unsubscribers.forEach((off) => off()); this.host?.remove(); }
}
