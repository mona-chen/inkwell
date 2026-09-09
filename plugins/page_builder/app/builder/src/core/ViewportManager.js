const DEFAULTS = { desktop: { width: 1440, height: 900 }, tablet: { width: 768, height: 1024 }, mobile: { width: 375, height: 667 } };
const editable = (target) => target?.isContentEditable || target?.closest?.('input,textarea,select');

// Real iframe dimensions retain browser breakpoints. The surrounding editor camera owns
// translation and scale; panning never changes the design or writes element positions.
export default class ViewportManager {
    constructor(builder) { this.builder = builder; this.device = 'desktop'; this.scale = 1; this.x = 0; this.y = 56; this.sizes = structuredClone(DEFAULTS); }
    mount(container) {
        this.container = container; this.stage = container.parentElement;
        this.renderBar(); this.renderHandles();
        this.panSurface = document.createElement('div'); this.panSurface.className = 'ink-pan-surface'; this.panSurface.hidden = true;
        this.stage.appendChild(this.panSurface);
        this.stage.addEventListener('pointerdown', (event) => this.startPan(event));
        this.stage.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
        this.builder.iframeDoc.addEventListener('wheel', (event) => this.onWheel(event, true), { passive: false });
        this.resizeObserver = new ResizeObserver(() => { if (this.fitted) this.fitScale(); });
        this.resizeObserver.observe(this.stage);
        return this;
    }
    renderBar() {
        this.bar = document.createElement('div'); this.bar.className = 'ink-v2-responsive-bar';
        this.bar.innerHTML = `<strong data-device-label>Desktop</strong><span class="ink-viewport-primary">Breakpoint</span><div class="ink-v2-viewport-size"><label>W <input aria-label="Viewport width" type="number" min="240" max="3840" data-width></label><label>H <input aria-label="Viewport height" type="number" min="320" max="4000" data-height></label></div>`;
        this.widthInput = this.bar.querySelector('[data-width]'); this.heightInput = this.bar.querySelector('[data-height]');
        [this.widthInput, this.heightInput].forEach((input) => input.addEventListener('change', () => { this.setSize(Number(this.widthInput.value), Number(this.heightInput.value)); if (this.fitted) this.fitScale(); }));
        this.container.prepend(this.bar);
    }
    renderHandles() {
        this.handles = ['w', 'e', 's'].map((edge) => { const handle = document.createElement('div'); handle.className = `ink-v2-viewport-handle is-${edge}`; handle.dataset.edge = edge; handle.addEventListener('pointerdown', (event) => this.startResize(event, edge)); this.container.appendChild(handle); return handle; });
    }
    setDevice(device) {
        if (!DEFAULTS[device]) return;
        this.device = device; this.container.dataset.inkViewportDevice = device;
        this.bar.querySelector('[data-device-label]').textContent = `${device[0].toUpperCase() + device.slice(1)} · ${this.sizes[device].width}`;
        ['desktop', 'tablet', 'mobile'].forEach((name) => { const button = document.getElementById(`${name}ModeButton`); button?.classList.toggle('active', name === device); button?.setAttribute('aria-pressed', String(name === device)); });
        const dimensions = this.sizes[device]; this.setSize(dimensions.width, dimensions.height); this.fitScale(); this.builder.breakpoints?.refresh();
    }
    setSize(width, height) {
        width = Math.max(240, Math.min(3840, width || DEFAULTS[this.device].width)); height = Math.max(320, Math.min(4000, height || DEFAULTS[this.device].height));
        this.sizes[this.device] = { width, height };
        this.container.style.width = `${width}px`; this.container.style.height = `${height}px`; this.builder.iframe.style.width = '100%'; this.builder.iframe.style.height = `${height}px`;
        this.widthInput.value = width; this.heightInput.value = height;
        this.bar.querySelector('[data-device-label]').textContent = `${this.device[0].toUpperCase() + this.device.slice(1)} · ${width}`;
        this.builder.breakpoints?.layout();
    }
    fitScale() {
        const width = this.builder.breakpoints?.enabled ? this.builder.breakpoints.totalWidth() : Number(this.widthInput.value) || DEFAULTS[this.device].width;
        this.scale = Math.max(.1, Math.min(1, (this.stage.clientWidth - 96) / width));
        this.x = (this.stage.clientWidth - width * this.scale) / 2; this.y = 64; this.fitted = true; this.applyCamera();
    }
    setScale(value, point = { x: this.stage.clientWidth / 2, y: this.stage.clientHeight / 2 }) {
        if (!Number.isFinite(value)) return;
        const next = Math.max(.1, Math.min(4, Math.round(value * 1000) / 1000));
        const ratio = next / this.scale;
        this.x = point.x - (point.x - this.x) * ratio; this.y = point.y - (point.y - this.y) * ratio;
        this.scale = next; this.fitted = false; this.applyCamera();
    }
    applyCamera() {
        this.container.style.setProperty('--ink-preview-scale', this.scale);
        this.builder.iframeDoc.documentElement.style.setProperty('--ink-editor-canvas-scale', this.scale);
        this.container.style.setProperty('--ink-preview-x', `${this.x + (this.builder.breakpoints?.activeOffset() || 0) * this.scale}px`); this.container.style.setProperty('--ink-preview-y', `${this.y}px`);
        this.builder.breakpoints?.layout();
        this.builder.runtime?.events.emit('viewport:change', { scale: this.scale });
    }
    focusSelection() {
        const ids = [...(this.builder.runtime?.selection.selectedIds || [])];
        const elements = ids.map((id) => this.builder.runtime.canvas.instances.get(id)?.element).filter(Boolean);
        if (!elements.length) { this.fitScale(); return; }
        const bounds = elements.map((element) => element.getBoundingClientRect());
        const left = Math.min(...bounds.map((rect) => rect.left)), top = Math.min(...bounds.map((rect) => rect.top));
        const width = Math.max(...bounds.map((rect) => rect.right)) - left, height = Math.max(...bounds.map((rect) => rect.bottom)) - top;
        this.scale = Math.max(.1, Math.min(2, (this.stage.clientWidth - 100) / Math.max(width, 1), (this.stage.clientHeight - 160) / Math.max(height, 1)));
        this.x = (this.stage.clientWidth - width * this.scale) / 2 - (left + (this.builder.breakpoints?.activeOffset() || 0)) * this.scale;
        this.y = (this.stage.clientHeight - height * this.scale) / 2 - top * this.scale;
        this.fitted = false; this.applyCamera();
    }
    setPanMode(enabled) { this.panSurface.hidden = !enabled; this.panEnabled = enabled; }
    startPan(event) {
        // The camera may own the canvas, but never gestures that start on editor controls.
        if (event.target.closest?.('.ink-canvas-toolbar,.ink-v2-responsive-bar,.ink-v2-viewport-handle,.ink-canvas-chrome,button,input,select,textarea')) return;
        if (event.button !== 1 && !(event.button === 0 && (this.panEnabled || event.target === this.stage))) return;
        event.preventDefault();
        const x = this.x, y = this.y, startX = event.clientX, startY = event.clientY;
        const wasEnabled = this.panEnabled; this.panSurface.hidden = false; this.panSurface.classList.add('is-panning');
        this.panSurface.setPointerCapture(event.pointerId);
        const move = (pointer) => { this.x = x + pointer.clientX - startX; this.y = y + pointer.clientY - startY; this.fitted = false; this.applyCamera(); };
        const stop = () => {
            if (Math.abs(this.x - x) + Math.abs(this.y - y) < 3 && !wasEnabled) this.builder.runtime.selection.clear();
            this.panSurface.removeEventListener('pointermove', move); this.panSurface.removeEventListener('pointerup', stop); this.panSurface.removeEventListener('pointercancel', stop);
            this.panSurface.classList.remove('is-panning'); this.panSurface.hidden = !this.panEnabled;
        };
        this.panSurface.addEventListener('pointermove', move); this.panSurface.addEventListener('pointerup', stop); this.panSurface.addEventListener('pointercancel', stop);
    }
    onWheel(event, inFrame = false) {
        if (this.builder.mode !== 'design' || editable(event.target) || (!inFrame && event.target.closest('.ink-canvas-toolbar,.ink-v2-responsive-bar'))) return;
        // Ordinary scroll inside the page stays native; pinch / Cmd-wheel zooms the camera.
        if (inFrame && !event.ctrlKey && !event.metaKey && !this.panEnabled) return;
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
            const stageRect = this.stage.getBoundingClientRect(), frameRect = this.builder.iframe.getBoundingClientRect();
            const x = inFrame ? frameRect.left - stageRect.left + event.clientX * this.scale : event.clientX - stageRect.left;
            const y = inFrame ? frameRect.top - stageRect.top + event.clientY * this.scale : event.clientY - stageRect.top;
            this.setScale(this.scale * Math.exp(-event.deltaY * .008), { x, y });
        } else { this.x -= event.deltaX; this.y -= event.deltaY; this.fitted = false; this.applyCamera(); }
    }
    startResize(event, edge) {
        event.preventDefault(); event.stopPropagation();
        const startX = event.clientX, startY = event.clientY, width = Number(this.widthInput.value), height = Number(this.heightInput.value), scale = this.scale, startCameraX = this.x;
        const handle = event.currentTarget; handle.setPointerCapture(event.pointerId);
        const move = (pointer) => {
            const dx = (pointer.clientX - startX) / scale, dy = (pointer.clientY - startY) / scale;
            this.setSize(edge === 'e' ? width + dx : edge === 'w' ? width - dx : width, edge === 's' ? height + dy : height);
            if (edge === 'w') this.x = startCameraX + (width - Number(this.widthInput.value)) * scale;
            this.fitted = false; this.applyCamera();
        };
        const stop = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', stop); handle.removeEventListener('pointercancel', stop); };
        handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop);
    }
}
