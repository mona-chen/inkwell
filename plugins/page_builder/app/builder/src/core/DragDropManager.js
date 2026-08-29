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

const DEVICES = ['desktop', 'tablet', 'mobile'];
const isSet = (value) => value !== undefined && value !== null && value !== '' && value !== 'auto';
const storedValue = (node, property, device) => {
    const end = Math.max(0, DEVICES.indexOf(device));
    for (let index = end; index >= 0; index -= 1) {
        const value = node.styles?.[DEVICES[index]]?.base?.[property];
        if (isSet(value)) return value;
    }
    return undefined;
};
const measurement = (value, fallback) => {
    if (value && typeof value === 'object' && Object.hasOwn(value, 'size')) return { size: Number(value.size) || 0, unit: value.unit || 'px' };
    if (typeof value === 'string') {
        const match = value.trim().match(/^(-?[\d.]+)\s*(px|%|rem|vw|vh)?$/i);
        if (match) return { size: Number(match[1]) || 0, unit: match[2] || 'px' };
    }
    return { size: Number(fallback) || 0, unit: 'px' };
};
const rounded = (value) => Math.round(value * 100) / 100;

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
        this.positionDrag = null;
        this.positionTooltip = null;
        this.rotateDrag = null;
        this.rotateTooltip = null;
        this.resizeDrag = null;
        this.resizeTooltip = null;
        this.radiusDrag = null;
        this.radiusTooltip = null;
        this.frameDraw = null;
        this.frameDrawPreview = null;
        this.marquee = null;
        this.snapGuides = [];
        this.distanceMarkers = [];
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
            // Resize/radius handles are pointer-driven; never start a move drag from them.
            if (event.target.closest('.ink-el-column-resize,.ink-resize-handle,.ink-radius-handle,.ink-rotate-handle')) return;
            const item = event.target.closest('[data-ink-element-id]');
            if (!item) return;
            this.beginDrag({ id: item.dataset.inkElementId }, event, this.iframeDoc);
        });

        // ---- iframe document: enter/over/leave/drop ----
        if (this.iframeDoc) {
            const pointerDown = (event) => { if (this.onRotatePointerDown(event)) return; if (this.onResizePointerDown(event)) return; if (this.onRadiusPointerDown(event)) return; if (!this.onFrameDrawPointerDown(event) && !this.onMarqueePointerDown(event)) this.onPositionPointerDown(event); };
            this.iframeDoc.addEventListener('pointerdown', pointerDown, true);
            this._unsubs.push(() => this.iframeDoc.removeEventListener('pointerdown', pointerDown, true));
            this.iframeDoc.addEventListener('dragenter', (event) => this.onDragEnterOver(event), true);
            this.iframeDoc.addEventListener('dragover', (event) => this.onDragEnterOver(event), true);
            this.iframeDoc.addEventListener('dragleave', (event) => this.onDragLeave(event), true);
            this.iframeDoc.addEventListener('drop', (event) => this.onDrop(event), true);
            this.iframeDoc.addEventListener('dragend', () => this.endDrag(), true);
        }
        this._unsubs.push(this.runtime.events.on('frame:draw', ({ parentId = null } = {}) => this.beginFrameDraw(parentId)));

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
        this.finishPositionDrag(false);
        this.finishRotateDrag(false);
        this.finishResizeDrag(false);
        this.finishRadiusDrag(false);
        this.cancelFrameDraw();
        this.endDrag();
        this._unsubs.forEach((fn) => fn());
        this._unsubs = [];
    }

    // ------------------------------------------------------- Frame drawing

    beginFrameDraw(parentId = null) {
        if (!this.iframeDoc?.body.classList.contains('ink-builder-design')) return;
        this.cancelFrameDraw();
        this.frameDraw = { requestedParentId: parentId };
        this.iframeDoc.body.classList.add('ink-is-drawing-frame');
    }

    cancelFrameDraw() {
        this.frameDrawPreview?.remove(); this.frameDrawPreview = null;
        this.frameDraw = null;
        this.iframeDoc?.body.classList.remove('ink-is-drawing-frame');
    }

    // ------------------------------------------------------- Marquee selection

    onMarqueePointerDown(event) {
        if (event.button !== 0 || this.frameDraw || this.positionDrag || !this.iframeDoc.body.classList.contains('ink-builder-design')) return false;
        // Marquee begins in blank canvas space only. This keeps text selection, controls, and
        // normal element clicks native and predictable.
        if (event.target !== this.canvas) return false;
        event.preventDefault();
        const start = { x: event.clientX, y: event.clientY };
        const preview = this.iframeDoc.createElement('div'); preview.className = 'ink-marquee-selection'; preview.dataset.inkEditorOnly = '';
        this.iframeDoc.body.appendChild(preview);
        const update = (pointer) => {
            const left = Math.min(start.x, pointer.clientX), top = Math.min(start.y, pointer.clientY);
            const width = Math.abs(pointer.clientX - start.x), height = Math.abs(pointer.clientY - start.y);
            preview.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
            this.marquee = { start, left, top, width, height, preview };
        };
        update(event);
        const finish = (pointer) => {
            update(pointer);
            const box = this.marquee;
            const hits = [...this.canvas.querySelectorAll('[data-ink-element-id]')].filter((element) => {
                if (element.dataset.inkLocked) return false;
                const rect = element.getBoundingClientRect();
                return rect.right >= box.left && rect.left <= box.left + box.width && rect.bottom >= box.top && rect.top <= box.top + box.height;
            }).map((element) => element.dataset.inkElementId);
            const ids = [...new Set(hits)];
            this.runtime.selection.clear();
            ids.forEach((id, index) => this.runtime.selection.select(id, { additive: index > 0 }));
            preview.remove(); this.marquee = null;
        };
        let clean = () => {};
        const cancel = (key) => { if (key.key === 'Escape') { clean(); preview.remove(); this.marquee = null; } };
        const up = (pointer) => { clean(); finish(pointer); };
        clean = () => { this.iframeDoc.removeEventListener('pointermove', update, true); this.iframeDoc.removeEventListener('pointerup', up, true); this.iframeDoc.removeEventListener('pointercancel', cancelPointer, true); this.iframeDoc.removeEventListener('keydown', cancel, true); };
        const cancelPointer = () => { clean(); preview.remove(); this.marquee = null; };
        this.iframeDoc.addEventListener('pointermove', update, true);
        this.iframeDoc.addEventListener('pointerup', up, true);
        this.iframeDoc.addEventListener('pointercancel', cancelPointer, true);
        this.iframeDoc.addEventListener('keydown', cancel, true);
        return true;
    }

    resolveFrameDrawParent(event) {
        const childHost = (element) => element?.querySelector?.(':scope > [data-ink-children]') || element?.querySelector?.('[data-ink-children]') || element;
        const requested = this.frameDraw?.requestedParentId && this.runtime.document.get(this.frameDraw.requestedParentId);
        if (requested && this.runtime.elements.get(requested.type)?.acceptsChildren) {
            const element = this.canvas.querySelector(`[data-ink-element-id="${CSS.escape(requested.id)}"]`);
            if (element) return { node: requested, element, childHost: childHost(element) };
        }
        let element = this.iframeDoc.elementFromPoint(event.clientX, event.clientY)?.closest('[data-ink-element-id]');
        while (element) {
            const node = this.runtime.document.get(element.dataset.inkElementId);
            if (node && this.runtime.elements.get(node.type)?.acceptsChildren) return { node, element, childHost: childHost(element) };
            element = element.parentElement?.closest?.('[data-ink-element-id]') || null;
        }
        return null;
    }

    onFrameDrawPointerDown(event) {
        if (!this.frameDraw || event.button !== 0 || !this.iframeDoc.body.classList.contains('ink-builder-design')) return false;
        if (event.target.closest?.('[data-ink-editor-only],input,textarea,select,[contenteditable="true"]')) return true;
        const parent = this.resolveFrameDrawParent(event);
        if (!parent) return true;
        event.preventDefault(); event.stopPropagation();
        // Absolute children are rendered into the child host. It is the CSS containing
        // block, so panel X/Y, draw placement, and drag placement must share this origin.
        const host = parent.childHost || parent.element;
        const rect = host.getBoundingClientRect();
        const originX = rect.left + host.clientLeft - host.scrollLeft;
        const originY = rect.top + host.clientTop - host.scrollTop;
        const start = { x: Math.max(rect.left, Math.min(event.clientX, rect.right)), y: Math.max(rect.top, Math.min(event.clientY, rect.bottom)) };
        const preview = this.iframeDoc.createElement('div'); preview.className = 'ink-frame-draw-preview'; preview.dataset.inkEditorOnly = '';
        this.iframeDoc.body.appendChild(preview); this.frameDrawPreview = preview;
        const update = (pointer) => {
            const x = Math.max(rect.left, Math.min(pointer.clientX, rect.right)), y = Math.max(rect.top, Math.min(pointer.clientY, rect.bottom));
            const left = Math.min(start.x, x), top = Math.min(start.y, y), width = Math.abs(x - start.x), height = Math.abs(y - start.y);
            preview.style.cssText = `left:${left}px;top:${top}px;width:${Math.max(1,width)}px;height:${Math.max(1,height)}px`;
            this.frameDraw.bounds = { left: left - originX, top: top - originY, width, height };
        };
        update(event);
        const finish = (pointer) => {
            update(pointer);
            const bounds = this.frameDraw?.bounds || { left: start.x - originX, top: start.y - originY, width: 0, height: 0 };
            const width = Math.max(120, Math.round(bounds.width || 240)), height = Math.max(80, Math.round(bounds.height || 160));
            const node = this.runtime.insert('frame', { parentId: parent.node.id, index: parent.node.children?.length || 0 }, { settings: { label: 'Frame' }, styles: { desktop: { base: { position: 'absolute', left: { size: Math.round(bounds.left), unit: 'px' }, top: { size: Math.round(bounds.top), unit: 'px' }, width: { size: width, unit: 'px' }, height: { size: height, unit: 'px' } } } } });
            this.runtime.selection.select(node.id); this.cancelFrameDraw();
        };
        let clean = () => {};
        const cancel = (key) => { if (key.key === 'Escape') { clean(); this.cancelFrameDraw(); } };
        clean = () => { this.iframeDoc.removeEventListener('pointermove', update, true); this.iframeDoc.removeEventListener('pointerup', up, true); this.iframeDoc.removeEventListener('pointercancel', cancelPointer, true); this.iframeDoc.removeEventListener('keydown', cancel, true); };
        const up = (pointer) => { clean(); finish(pointer); };
        const cancelPointer = () => { clean(); this.cancelFrameDraw(); };
        this.iframeDoc.addEventListener('pointermove', update, true);
        this.iframeDoc.addEventListener('pointerup', up, true);
        this.iframeDoc.addEventListener('pointercancel', cancelPointer, true);
        this.iframeDoc.addEventListener('keydown', cancel, true);
        return true;
    }

    // ------------------------------------------------------- positioned direct manipulation

    positionedElementFromEvent(event) {
        const action = event.target.closest?.('[data-ink-action="drag_indicator"]');
        const actionHost = action?.closest?.('[data-ink-element-id]');
        const direct = event.target.closest?.('[data-ink-element-id]');
        const selected = this.runtime.selection.selectedId;
        const selectedElement = selected && this.canvas.querySelector(`[data-ink-element-id="${CSS.escape(selected)}"]`);
        let element = actionHost ? this.canvas.querySelector(`[data-ink-element-id="${CSS.escape(actionHost.dataset.inkElementId)}"]`) : direct;
        if (!action && selectedElement?.contains(event.target)) element = selectedElement;
        if (!element || !this.canvas.contains(element)) return null;
        const position = this.iframeDoc.defaultView.getComputedStyle(element).position;
        return position === 'absolute' || position === 'fixed' ? element : null;
    }

    onPositionPointerDown(event) {
        if (event.button !== 0 || this.positionDrag || !this.iframeDoc.body.classList.contains('ink-builder-design')) return;
        if (event.target.closest?.('input,textarea,select,[contenteditable="true"],.ink-el-column-resize')) return;
        if (event.target.closest?.('.ink-editor-toolbar button:not([data-ink-action="drag_indicator"])')) return;
        const element = this.positionedElementFromEvent(event);
        if (!element || element.dataset.inkLocked) return;
        const id = element.dataset.inkElementId;
        const node = this.runtime.document.get(id);
        if (!node) return;

        event.preventDefault();
        event.stopPropagation();
        this.runtime.selection.select(id, { additive: false });
        const view = this.iframeDoc.defaultView;
        const computed = view.getComputedStyle(element);
        const position = computed.position;
        const offsetParent = position === 'fixed' ? null : element.offsetParent;
        const parentRect = offsetParent?.getBoundingClientRect() || { left: 0, top: 0, width: view.innerWidth, height: view.innerHeight };
        const parentWidth = offsetParent?.clientWidth || view.innerWidth || 1;
        const parentHeight = offsetParent?.clientHeight || view.innerHeight || 1;
        const rect = element.getBoundingClientRect();
        const originX = offsetParent ? parentRect.left + offsetParent.clientLeft - offsetParent.scrollLeft : 0;
        const originY = offsetParent ? parentRect.top + offsetParent.clientTop - offsetParent.scrollTop : 0;
        const geometry = {
            left: rect.left - originX,
            top: rect.top - originY,
            right: parentWidth - (rect.left - originX) - rect.width,
            bottom: parentHeight - (rect.top - originY) - rect.height,
            width: rect.width,
            height: rect.height,
        };
        const device = this.runtime.responsive.device || 'desktop';
        const raw = Object.fromEntries(['left', 'right', 'top', 'bottom'].map((side) => [side, storedValue(node, side, device)]));
        const active = {
            left: isSet(raw.left), right: isSet(raw.right), top: isSet(raw.top), bottom: isSet(raw.bottom),
        };
        if (!active.left && !active.right) active.left = true;
        if (!active.top && !active.bottom) active.top = true;
        const measures = Object.fromEntries(['left', 'right', 'top', 'bottom'].map((side) => [side, measurement(raw[side], geometry[side])]));
        const inlineBefore = Object.fromEntries(['left', 'right', 'top', 'bottom'].map((side) => [side, element.style.getPropertyValue(side)]));
        const spatial = this.collectSpatialTargets(element, node, originX, originY, parentWidth, parentHeight);
        const wasDraggable = element.draggable;
        element.draggable = false;
        this.positionDrag = {
            id, node, element, device, active, measures, inlineBefore, wasDraggable,
            startX: event.clientX, startY: event.clientY, parentWidth, parentHeight, originX, originY, spatial,
            geometry, moved: false, values: {},
        };
        this.iframeDoc.body.classList.add('ink-is-position-dragging');
        element.classList.add('ink-is-position-dragging');
        this.ensurePositionTooltip();
        const move = (pointer) => this.onPositionPointerMove(pointer);
        const up = () => this.finishPositionDrag(true);
        const cancel = (key) => { if (key.key === 'Escape') this.finishPositionDrag(false); };
        this.positionDrag.listeners = { move, up, cancel };
        this.iframeDoc.addEventListener('pointermove', move, true);
        this.iframeDoc.addEventListener('pointerup', up, true);
        this.iframeDoc.addEventListener('pointercancel', up, true);
        this.iframeDoc.addEventListener('keydown', cancel, true);
    }

    deltaForUnit(delta, unit, axis, drag) {
        if (unit === '%') return delta / (axis === 'x' ? drag.parentWidth : drag.parentHeight) * 100;
        if (unit === 'vw') return delta / Math.max(1, this.iframeDoc.defaultView.innerWidth) * 100;
        if (unit === 'vh') return delta / Math.max(1, this.iframeDoc.defaultView.innerHeight) * 100;
        if (unit === 'rem') return delta / (Number.parseFloat(this.iframeDoc.defaultView.getComputedStyle(this.iframeDoc.documentElement).fontSize) || 16);
        return delta;
    }

    collectSpatialTargets(element, node, originX, originY, parentWidth, parentHeight) {
        const parent = this.runtime.document.parentOf(node.id);
        const siblings = (parent ? parent.children : this.runtime.document.data.children)
            .filter((candidate) => candidate.id !== node.id)
            .map((candidate) => {
                const sibling = this.canvas.querySelector(`[data-ink-element-id="${CSS.escape(candidate.id)}"]`);
                if (!sibling || sibling.offsetParent !== element.offsetParent) return null;
                const rect = sibling.getBoundingClientRect();
                if (!rect.width && !rect.height) return null;
                const left = rect.left - originX; const top = rect.top - originY;
                return { id: candidate.id, left, top, right: left + rect.width, bottom: top + rect.height, width: rect.width, height: rect.height };
            }).filter(Boolean);
        const x = [
            { value: 0, kind: 'parent-edge' }, { value: parentWidth / 2, kind: 'parent-center' }, { value: parentWidth, kind: 'parent-edge' },
            ...siblings.flatMap((box) => [{ value: box.left, kind: 'sibling-edge', id: box.id }, { value: box.left + box.width / 2, kind: 'sibling-center', id: box.id }, { value: box.right, kind: 'sibling-edge', id: box.id }]),
        ];
        const y = [
            { value: 0, kind: 'parent-edge' }, { value: parentHeight / 2, kind: 'parent-center' }, { value: parentHeight, kind: 'parent-edge' },
            ...siblings.flatMap((box) => [{ value: box.top, kind: 'sibling-edge', id: box.id }, { value: box.top + box.height / 2, kind: 'sibling-center', id: box.id }, { value: box.bottom, kind: 'sibling-edge', id: box.id }]),
        ];
        return { siblings, x, y };
    }

    snapPosition(drag, dx, dy, disabled = false) {
        if (disabled) return { dx, dy, guides: [] };
        const threshold = 6;
        const proposed = { left: drag.geometry.left + dx, top: drag.geometry.top + dy };
        const points = {
            x: [proposed.left, proposed.left + drag.geometry.width / 2, proposed.left + drag.geometry.width],
            y: [proposed.top, proposed.top + drag.geometry.height / 2, proposed.top + drag.geometry.height],
        };
        const nearest = (axis) => {
            let match = null;
            drag.spatial[axis].forEach((target) => points[axis].forEach((source, sourceIndex) => {
                const delta = target.value - source; const distance = Math.abs(delta);
                if (distance <= threshold && (!match || distance < match.distance)) match = { axis, target, sourceIndex, delta, distance };
            }));
            return match;
        };
        const horizontal = nearest('x'); const vertical = nearest('y');
        return {
            dx: dx + (horizontal?.delta || 0),
            dy: dy + (vertical?.delta || 0),
            guides: [horizontal, vertical].filter(Boolean),
        };
    }

    onPositionPointerMove(event) {
        const drag = this.positionDrag;
        if (!drag) return;
        let dx = event.clientX - drag.startX;
        let dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) < 3) return;
        drag.moved = true;
        event.preventDefault(); event.stopPropagation();
        if (event.shiftKey) {
            if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
            else dx = 0;
        }
        const precision = event.metaKey || event.ctrlKey ? 10 : 1;
        dx = Math.round(dx * precision) / precision;
        dy = Math.round(dy * precision) / precision;
        const snapped = this.snapPosition(drag, dx, dy, event.altKey);
        dx = snapped.dx; dy = snapped.dy;
        this.renderSnapGuides(drag, snapped.guides);
        const values = {};
        const update = (side, delta, axis, sign = 1) => {
            if (!drag.active[side]) { drag.element.style.setProperty(side, 'auto'); return; }
            const start = drag.measures[side];
            const size = rounded(start.size + this.deltaForUnit(delta * sign, start.unit, axis, drag));
            values[side] = { size, unit: start.unit };
            drag.element.style.setProperty(side, `${size}${start.unit}`);
        };
        update('left', dx, 'x'); update('right', dx, 'x', -1);
        update('top', dy, 'y'); update('bottom', dy, 'y', -1);
        drag.values = values;
        const x = rounded(drag.geometry.left + dx); const y = rounded(drag.geometry.top + dy);
        this.renderDistanceMarkers(drag, { left: x, top: y, right: x + drag.geometry.width, bottom: y + drag.geometry.height });
        if (this.positionTooltip) {
            this.positionTooltip.textContent = `X ${x}  Y ${y}`;
            const rect = drag.element.getBoundingClientRect();
            this.positionTooltip.style.left = `${rect.left + rect.width / 2}px`;
            this.positionTooltip.style.top = `${rect.top}px`;
            this.positionTooltip.hidden = false;
        }
        this.runtime.events.emit('element:position-preview', { id: drag.id, device: drag.device, values });
    }

    renderSnapGuides(drag, guides) {
        this.clearSpatialOverlays('guides');
        guides.forEach((guide) => {
            const line = this.iframeDoc.createElement('div');
            const vertical = guide.axis === 'x';
            line.className = `ink-snap-guide is-${vertical ? 'vertical' : 'horizontal'} is-${guide.target.kind}`;
            line.dataset.inkEditorOnly = '';
            if (vertical) {
                line.style.left = `${drag.originX + guide.target.value}px`;
                line.style.top = `${drag.originY}px`;
                line.style.height = `${drag.parentHeight}px`;
            } else {
                line.style.left = `${drag.originX}px`;
                line.style.top = `${drag.originY + guide.target.value}px`;
                line.style.width = `${drag.parentWidth}px`;
            }
            this.iframeDoc.body.appendChild(line); this.snapGuides.push(line);
        });
    }

    renderDistanceMarkers(drag, current) {
        this.clearSpatialOverlays('distances');
        const boxes = drag.spatial.siblings;
        const verticalOverlap = (box) => box.bottom >= current.top && box.top <= current.bottom;
        const horizontalOverlap = (box) => box.right >= current.left && box.left <= current.right;
        const left = boxes.filter((box) => verticalOverlap(box) && box.right <= current.left).sort((a, b) => b.right - a.right)[0];
        const right = boxes.filter((box) => verticalOverlap(box) && box.left >= current.right).sort((a, b) => a.left - b.left)[0];
        const above = boxes.filter((box) => horizontalOverlap(box) && box.bottom <= current.top).sort((a, b) => b.bottom - a.bottom)[0];
        const below = boxes.filter((box) => horizontalOverlap(box) && box.top >= current.bottom).sort((a, b) => a.top - b.top)[0];
        const measures = [
            { orientation: 'horizontal', start: left?.right ?? 0, end: current.left, cross: current.top + (current.bottom - current.top) / 2 },
            { orientation: 'horizontal', start: current.right, end: right?.left ?? drag.parentWidth, cross: current.top + (current.bottom - current.top) / 2 },
            { orientation: 'vertical', start: above?.bottom ?? 0, end: current.top, cross: current.left + (current.right - current.left) / 2 },
            { orientation: 'vertical', start: current.bottom, end: below?.top ?? drag.parentHeight, cross: current.left + (current.right - current.left) / 2 },
        ].filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end >= item.start);
        measures.forEach((item) => {
            const marker = this.iframeDoc.createElement('div'); marker.className = `ink-distance-measure is-${item.orientation}`; marker.dataset.inkEditorOnly = '';
            const length = rounded(item.end - item.start); const label = this.iframeDoc.createElement('span'); label.textContent = String(length); marker.appendChild(label);
            if (item.orientation === 'horizontal') {
                marker.style.left = `${drag.originX + item.start}px`; marker.style.top = `${drag.originY + item.cross}px`; marker.style.width = `${Math.max(1, length)}px`;
            } else {
                marker.style.left = `${drag.originX + item.cross}px`; marker.style.top = `${drag.originY + item.start}px`; marker.style.height = `${Math.max(1, length)}px`;
            }
            this.iframeDoc.body.appendChild(marker); this.distanceMarkers.push(marker);
        });
    }

    clearSpatialOverlays(which = 'all') {
        if (which === 'all' || which === 'guides') { this.snapGuides.forEach((element) => element.remove()); this.snapGuides = []; }
        if (which === 'all' || which === 'distances') { this.distanceMarkers.forEach((element) => element.remove()); this.distanceMarkers = []; }
    }

    ensurePositionTooltip() {
        if (this.positionTooltip) return;
        this.positionTooltip = this.iframeDoc.createElement('div');
        this.positionTooltip.className = 'ink-position-tooltip';
        this.positionTooltip.dataset.inkEditorOnly = '';
        this.positionTooltip.hidden = true;
        this.iframeDoc.body.appendChild(this.positionTooltip);
    }

    finishPositionDrag(commit) {
        const drag = this.positionDrag;
        if (!drag) return;
        const { move, up, cancel } = drag.listeners || {};
        this.iframeDoc.removeEventListener('pointermove', move, true);
        this.iframeDoc.removeEventListener('pointerup', up, true);
        this.iframeDoc.removeEventListener('pointercancel', up, true);
        this.iframeDoc.removeEventListener('keydown', cancel, true);
        this.iframeDoc.body.classList.remove('ink-is-position-dragging');
        drag.element.classList.remove('ink-is-position-dragging');
        drag.element.draggable = drag.wasDraggable;
        if (this.positionTooltip) this.positionTooltip.hidden = true;
        this.clearSpatialOverlays();
        this.positionDrag = null;
        if (commit && drag.moved && Object.keys(drag.values).length) {
            this.runtime.update(drag.id, { styles: { [drag.device]: { base: drag.values } } }, 'Move positioned element');
        } else {
            Object.entries(drag.inlineBefore).forEach(([side, value]) => value ? drag.element.style.setProperty(side, value) : drag.element.style.removeProperty(side));
        }
    }

    // ------------------------------------------------------- rotation (direct manipulation)

    // Read the element's effective rotation in degrees from its stored rotate value.
    rotateDegrees(node, device) {
        const value = storedValue(node, 'rotate', device);
        if (typeof value === 'number') return value;
        if (value && typeof value === 'object') {
            const size = Number(value.size) || 0;
            return value.unit === 'turn' ? size * 360 : size;
        }
        return 0;
    }

    onRotatePointerDown(event) {
        if (event.button !== 0 || this.rotateDrag || !this.iframeDoc.body.classList.contains('ink-builder-design')) return false;
        const knob = event.target.closest?.('.ink-rotate-handle');
        if (!knob || this.positionDrag) return false;
        const element = knob.closest('[data-ink-element-id]');
        if (!element || this.canvas.contains(element) === false || element.dataset.inkLocked || element.dataset.inkKind === 'column') return false;
        const id = element.dataset.inkElementId;
        const node = this.runtime.document.get(id);
        if (!node) return false;

        event.preventDefault();
        event.stopPropagation();
        this.runtime.selection.select(id, { additive: false });

        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI;
        const device = this.runtime.responsive.device || 'desktop';
        const baseDeg = this.rotateDegrees(node, device);
        const wasDraggable = element.draggable;
        element.draggable = false;
        this.iframeDoc.body.classList.add('ink-is-rotating');
        this.rotateDrag = { id, node, element, device, baseDeg, startAngle, centerX, centerY, moved: false, value: baseDeg, listeners: null, wasDraggable };
        this.ensureRotateTooltip();
        const move = (pointer) => this.onRotatePointerMove(pointer);
        const up = () => this.finishRotateDrag(true);
        const cancel = (key) => { if (key.key === 'Escape') this.finishRotateDrag(false); };
        this.rotateDrag.listeners = { move, up, cancel };
        this.iframeDoc.addEventListener('pointermove', move, true);
        this.iframeDoc.addEventListener('pointerup', up, true);
        this.iframeDoc.addEventListener('pointercancel', up, true);
        this.iframeDoc.addEventListener('keydown', cancel, true);
        return true;
    }

    onRotatePointerMove(event) {
        const drag = this.rotateDrag;
        if (!drag) return;
        const angle = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX) * 180 / Math.PI;
        let delta = angle - drag.startAngle;
        // Normalise the shortest path so a full sweep still accumulates correctly.
        let next = drag.baseDeg + delta;
        if (event.shiftKey) next = Math.round(next / 15) * 15;
        next = Math.round(next * 10) / 10;
        if (!drag.moved && Math.abs(next - drag.baseDeg) < 0.5) return;
        drag.moved = true;
        drag.value = next;
        event.preventDefault(); event.stopPropagation();
        drag.element.style.setProperty('rotate', `${next}deg`);
        this.renderRotateTooltip(drag, next);
        this.runtime.events.emit('element:rotate-preview', { id: drag.id, device: drag.device, value: next });
    }

    ensureRotateTooltip() {
        if (this.rotateTooltip) return;
        this.rotateTooltip = this.iframeDoc.createElement('div');
        this.rotateTooltip.className = 'ink-rotate-tooltip';
        this.rotateTooltip.dataset.inkEditorOnly = '';
        this.rotateTooltip.hidden = true;
        this.iframeDoc.body.appendChild(this.rotateTooltip);
    }

    renderRotateTooltip(drag, degrees) {
        if (!this.rotateTooltip) return;
        this.rotateTooltip.textContent = `${degrees}°`;
        const rect = drag.element.getBoundingClientRect();
        this.rotateTooltip.style.left = `${rect.left + rect.width / 2}px`;
        this.rotateTooltip.style.top = `${rect.top}px`;
        this.rotateTooltip.hidden = false;
    }

    finishRotateDrag(commit) {
        const drag = this.rotateDrag;
        if (!drag) return;
        const { move, up, cancel } = drag.listeners || {};
        this.iframeDoc.removeEventListener('pointermove', move, true);
        this.iframeDoc.removeEventListener('pointerup', up, true);
        this.iframeDoc.removeEventListener('pointercancel', up, true);
        this.iframeDoc.removeEventListener('keydown', cancel, true);
        this.iframeDoc.body.classList.remove('ink-is-rotating');
        drag.element.draggable = drag.wasDraggable;
        if (this.rotateTooltip) this.rotateTooltip.hidden = true;
        this.rotateDrag = null;
        if (commit && drag.moved) {
            drag.element.style.removeProperty('rotate');
            this.runtime.update(drag.id, { styles: { [drag.device]: { base: { rotate: { size: drag.value, unit: 'deg' } } } } }, 'Rotate element');
        } else {
            drag.element.style.removeProperty('rotate');
        }
    }

    // ------------------------------------------------------- resize (direct manipulation)

    onResizePointerDown(event) {
        if (event.button !== 0 || this.resizeDrag || !this.iframeDoc.body.classList.contains('ink-builder-design')) return false;
        const handle = event.target.closest?.('[data-ink-resize-handle]');
        if (!handle) return false;
        const element = handle.closest('[data-ink-element-id]');
        if (!element || this.canvas.contains(element) === false || element.dataset.inkLocked || element.dataset.inkKind === 'column') return false;
        const id = element.dataset.inkElementId;
        const node = this.runtime.document.get(id);
        if (!node) return false;

        event.preventDefault();
        event.stopPropagation();
        this.runtime.selection.select(id, { additive: false });

        const view = this.iframeDoc.defaultView;
        const computed = view.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const device = this.runtime.responsive.device || 'desktop';
        const direction = handle.dataset.inkResizeHandle;

        // Parse current width/height to px. If the value is 'fit-content', 'auto', etc., use the
        // computed pixel size and store as px on commit.
        const parseSize = (raw, fallback) => {
            if (raw && typeof raw === 'object') return { size: Number(raw.size) || 0, unit: raw.unit || 'px' };
            if (typeof raw === 'string') {
                if (/fit-content|max-content|auto/.test(raw)) return { size: fallback, unit: 'px' };
                const match = raw.trim().match(/^(-?[\d.]+)\s*(px|%|rem|vw|vh)?$/i);
                if (match) return { size: Number(match[1]) || 0, unit: match[2] || 'px' };
            }
            return { size: fallback, unit: 'px' };
        };
        const rawW = storedValue(node, 'width', device);
        const rawH = storedValue(node, 'height', device);
        const baseW = parseSize(rawW, Math.round(rect.width));
        const baseH = parseSize(rawH, Math.round(rect.height));

        this.resizeDrag = {
            id, node, element, device, direction, baseW, baseH,
            startX: event.clientX, startY: event.clientY,
            origLeft: rect.left, origTop: rect.top, origRight: rect.right, origBottom: rect.bottom,
            origWidth: rect.width, origHeight: rect.height,
            listeners: null, moved: false, valueW: baseW, valueH: baseH,
        };
        this.ensureResizeTooltip();
        const move = (pointer) => this.onResizePointerMove(pointer);
        const up = () => this.finishResizeDrag(true);
        const cancel = (key) => { if (key.key === 'Escape') this.finishResizeDrag(false); };
        this.resizeDrag.listeners = { move, up, cancel };
        this.iframeDoc.addEventListener('pointermove', move, true);
        this.iframeDoc.addEventListener('pointerup', up, true);
        this.iframeDoc.addEventListener('pointercancel', up, true);
        this.iframeDoc.addEventListener('keydown', cancel, true);
        this.iframeDoc.body.classList.add('ink-is-resizing');
        return true;
    }

    onResizePointerMove(event) {
        const drag = this.resizeDrag;
        if (!drag) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) < 3) return;
        drag.moved = true;
        event.preventDefault(); event.stopPropagation();
        const d = drag.direction;
        let newW = drag.baseW.size;
        let newH = drag.baseH.size;
        const pxToUnit = (px, unit) => {
            if (unit === 'rem') return px / (Number.parseFloat(this.iframeDoc.defaultView.getComputedStyle(this.iframeDoc.documentElement).fontSize) || 16);
            return px;
        };
        if (d.includes('e')) newW = drag.baseW.size + pxToUnit(dx, drag.baseW.unit);
        if (d.includes('w')) newW = drag.baseW.size - pxToUnit(dx, drag.baseW.unit);
        if (d.includes('s')) newH = drag.baseH.size + pxToUnit(dy, drag.baseH.unit);
        if (d.includes('n')) newH = drag.baseH.size - pxToUnit(dy, drag.baseH.unit);
        if (event.shiftKey) {
            const delta = Math.max(Math.abs(newW - drag.baseW.size), Math.abs(newH - drag.baseH.size));
            if (d.includes('e') || d.includes('w')) newH = drag.baseH.size + (newW >= drag.baseW.size ? delta : -delta);
            else newW = drag.baseW.size + (newH >= drag.baseH.size ? delta : -delta);
        }
        newW = Math.max(1, Math.round(newW * 10) / 10);
        newH = Math.max(1, Math.round(newH * 10) / 10);
        drag.valueW = { size: newW, unit: drag.baseW.unit };
        drag.valueH = { size: newH, unit: drag.baseH.unit };
        drag.element.style.width = `${newW}${drag.baseW.unit}`;
        drag.element.style.height = `${newH}${drag.baseH.unit}`;
        // For fit-content elements (buttons), also stretch the visual surface so it fills the
        // explicit root size. Without this, the root grows but the surface stays content-sized.
        const surface = drag.element.querySelector('.ink-el-button-surface, .ink-el-frame-inner, .ink-el-container-inner');
        if (surface) { surface.style.minHeight = '0'; surface.style.height = '100%'; }
        this.renderResizeTooltip(drag, newW, newH);
    }

    ensureResizeTooltip() {
        if (this.resizeTooltip) return;
        this.resizeTooltip = this.iframeDoc.createElement('div');
        this.resizeTooltip.className = 'ink-resize-tooltip';
        this.resizeTooltip.dataset.inkEditorOnly = '';
        this.resizeTooltip.hidden = true;
        this.iframeDoc.body.appendChild(this.resizeTooltip);
    }

    renderResizeTooltip(drag, w, h) {
        if (!this.resizeTooltip) return;
        this.resizeTooltip.textContent = `${Math.round(w)} × ${Math.round(h)}`;
        const rect = drag.element.getBoundingClientRect();
        this.resizeTooltip.style.left = `${rect.left + rect.width / 2}px`;
        this.resizeTooltip.style.top = `${rect.top}px`;
        this.resizeTooltip.hidden = false;
    }

    finishResizeDrag(commit) {
        const drag = this.resizeDrag;
        if (!drag) return;
        const { move, up, cancel } = drag.listeners || {};
        this.iframeDoc.removeEventListener('pointermove', move, true);
        this.iframeDoc.removeEventListener('pointerup', up, true);
        this.iframeDoc.removeEventListener('pointercancel', up, true);
        this.iframeDoc.removeEventListener('keydown', cancel, true);
        this.iframeDoc.body.classList.remove('ink-is-resizing');
        if (this.resizeTooltip) this.resizeTooltip.hidden = true;
        this.resizeDrag = null;
        drag.element.style.removeProperty('width');
        drag.element.style.removeProperty('height');
        // Clean up any surface stretch applied during drag.
        const surface = drag.element.querySelector('.ink-el-button-surface, .ink-el-frame-inner, .ink-el-container-inner');
        if (surface) { surface.style.removeProperty('min-height'); surface.style.removeProperty('height'); }
        if (commit && drag.moved) {
            const patch = { width: drag.valueW, height: drag.valueH };
            // The button root has align-items:flex-end (SCSS), which pushes the surface to the
            // bottom when height is explicit. Override to stretch so the surface fills the root.
            const computed = this.iframeDoc.defaultView.getComputedStyle(drag.element);
            const align = computed.alignItems;
            if (align === 'flex-end' || align === 'center') patch['align-items'] = 'stretch';
            this.runtime.update(drag.id, { styles: { [drag.device]: { base: patch } } }, 'Resize element');
        }
    }

    // ------------------------------------------------------- corner radius (direct manipulation)

    onRadiusPointerDown(event) {
        if (event.button !== 0 || this.radiusDrag || !this.iframeDoc.body.classList.contains('ink-builder-design')) return false;
        const knob = event.target.closest?.('[data-ink-radius-handle]');
        if (!knob) return false;
        const element = knob.closest('[data-ink-element-id]');
        if (!element || this.canvas.contains(element) === false || element.dataset.inkLocked || element.dataset.inkKind === 'column') return false;
        const id = element.dataset.inkElementId;
        const node = this.runtime.document.get(id);
        if (!node) return false;

        event.preventDefault();
        event.stopPropagation();
        this.runtime.selection.select(id, { additive: false });

        const view = this.iframeDoc.defaultView;
        const rect = element.getBoundingClientRect();
        const device = this.runtime.responsive.device || 'desktop';

        // Parse current border-radius to a px value.
        const raw = storedValue(node, 'border-radius', device);
        let baseRadius = 0;
        let radiusUnit = 'px';
        if (raw && typeof raw === 'object' && 'size' in raw) { baseRadius = Number(raw.size) || 0; radiusUnit = raw.unit || 'px'; }
        else if (typeof raw === 'string') { const m = raw.match(/^(-?[\d.]+)/); if (m) baseRadius = Number(m[1]) || 0; }

        this.radiusDrag = {
            id, node, element, device, baseRadius, radiusUnit, startX: event.clientX, startY: event.clientY,
            listeners: null, moved: false, value: baseRadius,
        };
        this.ensureRadiusTooltip();
        const move = (pointer) => this.onRadiusPointerMove(pointer);
        const up = () => this.finishRadiusDrag(true);
        const cancel = (key) => { if (key.key === 'Escape') this.finishRadiusDrag(false); };
        this.radiusDrag.listeners = { move, up, cancel };
        this.iframeDoc.addEventListener('pointermove', move, true);
        this.iframeDoc.addEventListener('pointerup', up, true);
        this.iframeDoc.addEventListener('pointercancel', up, true);
        this.iframeDoc.addEventListener('keydown', cancel, true);
        return true;
    }

    onRadiusPointerMove(event) {
        const drag = this.radiusDrag;
        if (!drag) return;
        const deltaX = event.clientX - drag.startX;
        let next = drag.baseRadius - deltaX;
        if (event.shiftKey) next = Math.round(next / 5) * 5;
        next = Math.max(0, Math.round(next * 10) / 10);
        if (!drag.moved && Math.abs(next - drag.baseRadius) < 0.5) return;
        drag.moved = true;
        drag.value = next;
        drag.perCorner = event.shiftKey;
        event.preventDefault(); event.stopPropagation();
        const target = drag.element.querySelector('.ink-el-button-surface') || drag.element;
        // Uniform: all corners same. Per-corner (Shift): only top-right.
        if (drag.perCorner) {
            target.style.borderRadius = `0px ${next}${drag.radiusUnit} 0px 0px`;
        } else {
            target.style.borderRadius = `${next}${drag.radiusUnit}`;
        }
        this.renderRadiusTooltip(drag, next, drag.perCorner);
    }

    ensureRadiusTooltip() {
        if (this.radiusTooltip) return;
        this.radiusTooltip = this.iframeDoc.createElement('div');
        this.radiusTooltip.className = 'ink-resize-tooltip';
        this.radiusTooltip.dataset.inkEditorOnly = '';
        this.radiusTooltip.hidden = true;
        this.iframeDoc.body.appendChild(this.radiusTooltip);
    }

    renderRadiusTooltip(drag, radius, perCorner) {
        if (!this.radiusTooltip) return;
        this.radiusTooltip.textContent = perCorner ? `${radius}px (top-right)` : `${radius}px`;
        const rect = drag.element.getBoundingClientRect();
        this.radiusTooltip.style.left = `${rect.right}px`;
        this.radiusTooltip.style.top = `${rect.top}px`;
        this.radiusTooltip.hidden = false;
    }

    finishRadiusDrag(commit) {
        const drag = this.radiusDrag;
        if (!drag) return;
        const { move, up, cancel } = drag.listeners || {};
        this.iframeDoc.removeEventListener('pointermove', move, true);
        this.iframeDoc.removeEventListener('pointerup', up, true);
        this.iframeDoc.removeEventListener('pointercancel', up, true);
        this.iframeDoc.removeEventListener('keydown', cancel, true);
        if (this.radiusTooltip) this.radiusTooltip.hidden = true;
        this.radiusDrag = null;
        const target = drag.element.querySelector('.ink-el-button-surface') || drag.element;
        target.style.removeProperty('border-radius');
        if (commit && drag.moved) {
            const unit = drag.radiusUnit;
            const val = drag.value;
            // Per-corner: write dimensions object. Uniform: write size object.
            const radiusValue = drag.perCorner
                ? { top: 0, right: val, bottom: 0, left: 0, unit }
                : { size: val, unit };
            this.runtime.update(drag.id, { styles: { [drag.device]: { base: { 'border-radius': radiusValue } } } }, 'Change corner radius');
        }
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
