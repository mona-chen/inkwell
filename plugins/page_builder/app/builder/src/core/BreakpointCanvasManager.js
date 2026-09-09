const DEVICES = ['desktop', 'tablet', 'mobile'];

// One editable document, viewed at three real browser widths. The selected breakpoint owns
// the live iframe; adjacent views mirror its DOM and select the same source IDs on click.
export default class BreakpointCanvasManager {
    constructor(builder) { this.builder = builder; this.viewport = builder.viewport; this.enabled = false; this.previews = new Map(); this.unsubscribers = []; }
    mount() {
        DEVICES.forEach((device) => {
            const host = document.createElement('div'); host.className = 'ink-breakpoint-preview'; host.hidden = true;
            const label = document.createElement('button'); label.type = 'button'; label.className = 'ink-breakpoint-label'; label.addEventListener('click', () => this.activate(device));
            const iframe = document.createElement('iframe'); iframe.title = `${device} breakpoint preview`;
            // Adjacent views are inert previews. No page-authored JavaScript runs here.
            iframe.setAttribute('sandbox', 'allow-same-origin');
            iframe.addEventListener('load', () => {
                const doc = iframe.contentDocument; if (!doc) return;
                doc.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.activate(device, event.target.closest('[data-ink-element-id]')?.dataset.inkElementId); }, true);
                doc.addEventListener('submit', (event) => event.preventDefault(), true);
                doc.addEventListener('wheel', (event) => {
                    if (!event.ctrlKey && !event.metaKey) return;
                    event.preventDefault();
                    const rect = iframe.getBoundingClientRect(), stage = this.viewport.stage.getBoundingClientRect();
                    this.viewport.setScale(this.viewport.scale * Math.exp(-event.deltaY * .008), { x: rect.left - stage.left + event.clientX * this.viewport.scale, y: rect.top - stage.top + event.clientY * this.viewport.scale });
                }, { passive: false });
            });
            host.append(label, iframe); this.viewport.stage.appendChild(host); this.previews.set(device, { host, label, iframe });
        });
        ['document:update', 'document:insert', 'document:remove', 'document:replace', 'document:move', 'document:settings', 'canvas:render'].forEach((event) => this.unsubscribers.push(this.builder.runtime.events.on(event, () => this.schedule())));
        this.observer = new MutationObserver(() => this.schedule());
        this.observer.observe(this.builder.iframeDoc.head, { childList: true, subtree: true, characterData: true });
        this.unsubscribers.push(this.builder.runtime.events.on('editor:mode', ({ mode }) => {
            if (mode === 'preview') { this.restoreAfterPreview = this.enabled; this.setEnabled(false); }
            else if (this.restoreAfterPreview) { this.restoreAfterPreview = false; this.setEnabled(true); }
        }));
        return this;
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        document.body.classList.toggle('ink-breakpoint-overview', enabled);
        document.querySelector('[data-studio-breakpoints]')?.setAttribute('aria-pressed', String(enabled));
        this.refresh(); this.viewport.fitScale();
    }
    offsets() {
        let x = 0; const offsets = {};
        DEVICES.forEach((device) => { offsets[device] = x; x += this.viewport.sizes[device].width + 100; });
        return offsets;
    }
    totalWidth() { return DEVICES.reduce((width, device) => width + this.viewport.sizes[device].width, 200); }
    activeOffset() { return this.enabled ? this.offsets()[this.viewport.device] : 0; }
    activate(device, id) {
        const camera = { x: this.viewport.x, y: this.viewport.y, scale: this.viewport.scale, fitted: this.viewport.fitted };
        this.builder.setDevice(device);
        Object.assign(this.viewport, camera); this.viewport.applyCamera();
        if (id && this.builder.runtime.document.get(id)) this.builder.runtime.selection.select(id);
        this.refresh();
    }
    schedule() {
        if (!this.enabled) return;
        clearTimeout(this.timer); this.timer = setTimeout(() => this.refresh(), 120);
    }
    refresh() {
        this.previews.forEach(({ host }, device) => { host.hidden = !this.enabled || device === this.viewport.device; });
        if (!this.enabled) return;
        const clone = this.builder.iframeDoc.documentElement.cloneNode(true);
        clone.querySelectorAll('script,[data-ink-editor-only],#ink-editor-canvas-styles').forEach((node) => node.remove());
        clone.querySelectorAll('.ink-is-selected').forEach((node) => node.classList.remove('ink-is-selected'));
        clone.querySelectorAll('[contenteditable],[draggable]').forEach((node) => { node.removeAttribute('contenteditable'); node.removeAttribute('draggable'); });
        clone.querySelector('body').classList.remove('ink-builder-design');
        clone.style.removeProperty('--ink-editor-canvas-scale');
        const style = document.createElement('style'); style.textContent = 'html{scrollbar-width:none}*{cursor:pointer!important}'; clone.querySelector('head').appendChild(style);
        const source = '<!doctype html>' + clone.outerHTML;
        this.previews.forEach(({ iframe }, device) => { if (device !== this.viewport.device && iframe.srcdoc !== source) iframe.srcdoc = source; });
        this.layout();
    }
    layout() {
        if (!this.enabled) return;
        const offsets = this.offsets(), { scale, x, y } = this.viewport;
        this.previews.forEach(({ host, iframe, label }, device) => {
            host.hidden = device === this.viewport.device;
            const { width, height } = this.viewport.sizes[device];
            host.style.cssText = `width:${width}px;height:${height}px;transform:translate(${x + offsets[device] * scale}px,${y}px) scale(${scale});--ink-preview-scale:${scale}`;
            iframe.style.height = `${height}px`; label.textContent = `${device === 'mobile' ? 'Phone' : device[0].toUpperCase() + device.slice(1)} · ${width}`;
        });
    }
    destroy() { clearTimeout(this.timer); this.observer?.disconnect(); this.unsubscribers.forEach((off) => off()); this.previews.forEach(({ host }) => host.remove()); }
}
