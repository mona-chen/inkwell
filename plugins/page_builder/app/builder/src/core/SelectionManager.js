export default class SelectionManager {
    constructor({ document, events } = {}) {
        this.document = document;
        this.events = events;
        this.selectedId = null;
        this.selectedIds = new Set();
        this.hoveredId = null;
    }

    select(id, { additive = false } = {}) {
        if (id && !this.document.get(id)) throw new Error(`Cannot select unknown element: ${id}`);
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
