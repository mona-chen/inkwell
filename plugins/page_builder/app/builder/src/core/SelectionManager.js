export default class SelectionManager {
    constructor({ document, events } = {}) {
        this.document = document;
        this.events = events;
        this.selectedId = null;
        this.selectedIds = new Set();
        this.hoveredId = null;
        this.pendingPick = null;
    }

    // Element picking: while a pick is armed the next selection resolves the pick instead of
    // changing the selection, so a control can ask the author to click a layer on the canvas.
    // Hovering still works, which is what makes aiming at a layer feel like the canvas.
    armPick() {
        if (this.pendingPick) this.cancelPick();
        this.pendingPick = { armed: true };
        this.events?.emit('picker:armed', {});
    }

    cancelPick() {
        if (!this.pendingPick) return;
        this.pendingPick = null;
        this.events?.emit('picker:cancelled', {});
    }

    select(id, { additive = false } = {}) {
        if (id && !this.document.get(id)) throw new Error(`Cannot select unknown element: ${id}`);
        if (id && this.pendingPick) {
            this.pendingPick = null;
            this.events?.emit('picker:picked', { id });
            return;
        }
        if (!additive) this.selectedIds = new Set(id ? [id] : []);
        else if (id) this.selectedIds.has(id) ? this.selectedIds.delete(id) : this.selectedIds.add(id);
        this.selectedId = id && this.selectedIds.has(id) ? id : [...this.selectedIds].at(-1) || null;
        this.events?.emit('selection:change', { id: this.selectedId, ids: [...this.selectedIds], path: this.selectedId ? this.document.pathTo(this.selectedId).map((node) => node.id) : [] });
    }

    hover(id) {
        if (id === this.hoveredId) return;
        this.hoveredId = id;
        this.events?.emit('selection:hover', { id });
    }

    clear() { this.select(null); this.hover(null); }
}
