// Cross-document drag & drop.
//
// The library lives in the parent document while the canvas is an <iframe>, and HTML5 drag
// events do not cross documents. This manager:
//   - tracks the active drag payload itself (source type for new elements, source id for moves)
//     so it never depends on custom MIME data surviving the parent -> iframe boundary;
//   - mirrors the payload onto a shared window slot as a second fallback;
//   - listens on the iframe DOCUMENT (capture phase) for dragenter/dragover/drop so the canvas
//     reacts even when the pointer is over empty stage or nested containers;
//   - resolves the drop target from pointer coordinates instead of event.target;
//   - keeps a custom drag ghost alive until dragend;
//   - renders a visible drop indicator and cleans up on drop, dragend, Escape, and blur.

const MIME_TYPE = 'application/x-ink-element-type';
const MIME_ID = 'application/x-ink-element-id';
const SHARED_SLOT = '__inkDragPayload';

export default class DragDropManager {
    constructor({ runtime, canvas, library } = {}) {
        this.runtime = runtime;
        this.canvas = canvas;      // canvas root element inside the iframe
        this.library = library;    // parent-document library panel
        this.iframeDoc = canvas?.ownerDocument || null;
        this.parentDoc = library?.ownerDocument || this.iframeDoc?.defaultView?.parent?.document || document;
        this.drag = null;          // active payload { type } | { id }
        this.intent = null;        // resolved drop position
        this.ghost = null;
        this.dropLine = null;
        this._unsubs = [];
    }

    mount() {
        const parent = this.parentDoc;

        // ---- Library (parent document): start of a new-element drag ----
        this.library?.addEventListener('dragstart', (event) => {
            const item = event.target.closest('[data-ink-element-type]');
            if (!item) return;
            this.beginDrag({ type: item.dataset.inkElementType }, event, parent);
        });

        // ---- Canvas element move drags (inside the iframe) ----
        this.iframeDoc.addEventListener('dragstart', (event) => {
            // Resize handles are pointer-driven; never start a move drag from them.
            if (event.target.closest('.ink-el-column-resize')) return;
            const item = event.target.closest('[data-ink-element-id]');
            if (!item) return;
            this.beginDrag({ id: item.dataset.inkElementId }, event, this.iframeDoc);
        });

        // ---- iframe document: enter/over/leave/drop ----
        if (this.iframeDoc) {
            this.iframeDoc.addEventListener('dragenter', (event) => this.onDragEnterOver(event), true);
            this.iframeDoc.addEventListener('dragover', (event) => this.onDragEnterOver(event), true);
            this.iframeDoc.addEventListener('dragleave', (event) => this.onDragLeave(event), true);
            this.iframeDoc.addEventListener('drop', (event) => this.onDrop(event), true);
            this.iframeDoc.addEventListener('dragend', () => this.endDrag(), true);
        }

        // ---- Cleanup hooks ----
        parent.addEventListener('dragend', () => this.endDrag(), true);
        parent.addEventListener('keydown', (event) => { if (event.key === 'Escape') this.endDrag(); });
        parent.defaultView?.addEventListener('blur', () => this.endDrag());
        if (this.iframeDoc) {
            this.iframeDoc.addEventListener('dragend', () => this.endDrag(), true);
            this.iframeDoc.addEventListener('keydown', (event) => { if (event.key === 'Escape') this.endDrag(); });
        }

        this.canvas.addEventListener('dragover', (event) => { event.preventDefault(); });
        this.canvas.addEventListener('drop', (event) => { event.preventDefault(); });
        return this;
    }

    destroy() {
        this.endDrag();
        this._unsubs.forEach((fn) => fn());
        this._unsubs = [];
    }

    // ------------------------------------------------------------------ session

    beginDrag(payload, event, doc) {
        this.drag = payload;
        this.cancelled = false;
        try { window[SHARED_SLOT] = payload; } catch (_) {}
        const transfer = event?.dataTransfer;
        if (transfer) {
            transfer.effectAllowed = payload.id ? 'move' : 'copy';
            try {
                transfer.setData(MIME_TYPE, payload.type || '');
                transfer.setData(MIME_ID, payload.id || '');
                const label = payload.id
                    ? this.runtime.elements.get(this.runtime.document.get(payload.id)?.type || '').title
                    : this.runtime.elements.get(payload.type)?.title || '';
                transfer.setData('text/plain', label || '');
            } catch (_) { /* dataTransfer may be read-only during synthetic drags */ }
        }
        // Custom ghost, kept alive until dragend (not removed on next frame).
        const host = doc || (payload.id ? this.iframeDoc : this.parentDoc) || document;
        this.removeGhost();
        this.ghost = host.createElement('div');
        this.ghost.className = 'ink-drag-ghost';
        this.ghost.textContent = payload.id
            ? this.runtime.elements.get(this.runtime.document.get(payload.id)?.type || '').title
            : (this.runtime.elements.get(payload.type)?.title || payload.type);
        host.body.appendChild(this.ghost);
        if (transfer) { try { transfer.setDragImage(this.ghost, 20, 20); } catch (_) {} }
    }

    removeGhost() {
        if (this.ghost) { this.ghost.remove(); this.ghost = null; }
    }

    isActiveDrag() {
        if (this.drag?.type || this.drag?.id) return true;
        try { const shared = window[SHARED_SLOT]; if (shared?.type || shared?.id) return true; } catch (_) {}
        return false;
    }

    resolvePayload(event) {
        const transfer = event?.dataTransfer;
        if (transfer) {
            try {
                const type = transfer.getData(MIME_TYPE);
                const id = transfer.getData(MIME_ID);
                if (type || id) return { type: type || null, id: id || null };
            } catch (_) {}
        }
        if (this.drag?.type || this.drag?.id) return this.drag;
        try { const shared = window[SHARED_SLOT]; if (shared?.type || shared?.id) return shared; } catch (_) {}
        return null;
    }

    // ------------------------------------------------------------------ intent

    axisFor(element) {
        const parent = element.parentElement;
        if (!parent) return 'column';
        const direction = parent.ownerDocument.defaultView.getComputedStyle(parent).flexDirection;
        return direction && direction.startsWith('row') ? 'row' : 'column';
    }

    // Resolve the nearest element under the pointer and a before/after/inside position.
    computeIntent(event) {
        const doc = this.iframeDoc;
        const targetElement = doc.elementFromPoint(event.clientX, event.clientY)?.closest('[data-ink-element-id]') || null;
        if (!targetElement) return { parentId: null, index: this.runtime.document.data.children.length, element: null, position: 'inside', axis: 'column' };
        const target = this.runtime.document.get(targetElement.dataset.inkElementId);
        if (!target) return null;
        const rect = targetElement.getBoundingClientRect();
        const axis = this.axisFor(targetElement);
        const ratio = (axis === 'row' ? (event.clientX - rect.left) : (event.clientY - rect.top)) / Math.max(axis === 'row' ? rect.width : rect.height, 1);
        let position = ratio < .3 ? 'before' : ratio > .7 ? 'after' : 'inside';
        if (position === 'inside' && !this.runtime.elements.get(target.type).acceptsChildren) position = ratio < .5 ? 'before' : 'after';
        if (position === 'inside') return { parentId: target.id, index: target.children?.length || 0, element: targetElement, position, axis };
        const parent = this.runtime.document.parentOf(target.id);
        const siblings = parent ? parent.children : this.runtime.document.data.children;
        const targetIndex = siblings.findIndex((node) => node.id === target.id);
        return { parentId: parent?.id || null, index: targetIndex + (position === 'after' ? 1 : 0), element: targetElement, position, axis };
    }

    setIntent(intent) {
        this.clearIntent();
        this.intent = intent;
        if (intent?.element) {
            intent.element.dataset.inkDropPosition = intent.position;
            intent.element.dataset.inkDropAxis = intent.axis;
        }
        this.renderDropIndicator(intent);
    }

    clearIntent() {
        if (this.intent?.element) {
            delete this.intent.element.dataset.inkDropPosition;
            delete this.intent.element.dataset.inkDropAxis;
        }
        this.intent = null;
        this.removeDropLine();
    }

    // A legible accent line at the exact insertion point, above element overlays.
    renderDropIndicator(intent) {
        if (!intent || !intent.element) { this.removeDropLine(); return; }
        if (intent.position === 'inside') { this.removeDropLine(); return; }
        if (!this.iframeDoc) return;
        if (!this.dropLine) { this.dropLine = this.iframeDoc.createElement('div'); this.dropLine.className = 'ink-editor-drop-line'; this.iframeDoc.body.appendChild(this.dropLine); }
        const rect = intent.element.getBoundingClientRect();
        const scrollX = this.iframeDoc.defaultView.scrollX || 0;
        const scrollY = this.iframeDoc.defaultView.scrollY || 0;
        const axis = intent.axis;
        if (intent.position === 'before') {
            if (axis === 'row') { this.dropLine.style.cssText = `left:${rect.left - 2 + scrollX}px;top:${rect.top + scrollY}px;width:4px;height:${rect.height}px`; }
            else { this.dropLine.style.cssText = `left:${rect.left + scrollX}px;top:${rect.top - 2 + scrollY}px;width:${rect.width}px;height:4px`; }
        } else {
            if (axis === 'row') { this.dropLine.style.cssText = `left:${rect.right - 2 + scrollX}px;top:${rect.top + scrollY}px;width:4px;height:${rect.height}px`; }
            else { this.dropLine.style.cssText = `left:${rect.left + scrollX}px;top:${rect.bottom - 2 + scrollY}px;width:${rect.width}px;height:4px`; }
        }
    }

    removeDropLine() {
        if (this.dropLine) { this.dropLine.remove(); this.dropLine = null; }
    }

    // ------------------------------------------------------------------ handlers

    onDragEnterOver(event) {
        if (!this.isActiveDrag()) return;
        event.preventDefault();
        const intent = this.computeIntent(event);
        if (intent) this.setIntent(intent);
    }

    onDragLeave(event) {
        if (this.iframeDoc.contains(event.relatedTarget)) return;
        this.setIntent({ parentId: null, index: this.runtime.document.data.children.length, element: null, position: 'inside', axis: 'column' });
    }

    // Walk up from a rejected parent until an ancestor (or the root) accepts the node.
    findTarget(parentId, node) {
        let candidate = parentId ? this.runtime.document.get(parentId) : null;
        while (candidate) {
            if (this.runtime.elements.accepts(candidate, node)) return { parentId: candidate.id, index: candidate.children?.length || 0 };
            candidate = this.runtime.document.parentOf(candidate.id);
        }
        return { parentId: null, index: this.runtime.document.data.children.length };
    }

    onDrop(event) {
        event.preventDefault();
        if (this.cancelled) { this.endDrag(); return; }
        const payload = this.resolvePayload(event);
        const intent = this.intent || (() => { const i = this.computeIntent(event); return i || null; })();
        this.endDrag();
        if (!payload || !intent) return;
        try {
            if (payload.type) {
                const overrides = {};
                if (payload.type === 'columns') overrides = { settings: { structure: '50,50' }, children: [this.runtime.create('column'), this.runtime.create('column')] };
                const node = this.runtime.create(payload.type, overrides);
                const parentNode = intent.parentId ? this.runtime.document.get(intent.parentId) : null;
                const target = !parentNode || this.runtime.elements.accepts(parentNode, node) ? { parentId: intent.parentId, index: intent.index } : this.findTarget(intent.parentId, node);
                const inserted = this.runtime.insert(payload.type, target, overrides);
                this.runtime.selection.select(inserted.id);
            } else if (payload.id) {
                const node = this.runtime.document.get(payload.id);
                if (!node) return;
                const parentNode = intent.parentId ? this.runtime.document.get(intent.parentId) : null;
                const target = !parentNode || this.runtime.elements.accepts(parentNode, node) ? { parentId: intent.parentId, index: intent.index } : this.findTarget(intent.parentId, node);
                this.runtime.move(payload.id, target);
                this.runtime.selection.select(payload.id);
            }
        } catch (error) {
            if (typeof console !== 'undefined') console.error('[DragDropManager] drop failed:', error);
        }
    }

    endDrag() {
        this.clearIntent();
        this.removeGhost();
        this.cancelled = true;
        this.drag = null;
        try { delete window[SHARED_SLOT]; } catch (_) {}
    }
}
