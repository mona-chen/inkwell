// Every preview mode owns a real virtual viewport. Using the leftover editor width for
// desktop lets a narrow panel/stage accidentally trigger tablet or mobile media queries.
const DEFAULTS = { desktop: { width: 1440, height: 900 }, tablet: { width: 768, height: 1024 }, mobile: { width: 375, height: 667 } };

export default class ViewportManager {
    constructor(builder) { this.builder = builder; this.device = 'desktop'; this.scale = 1; }

    mount(container) {
        this.container = container; this.renderBar(); this.renderHandles(); return this;
    }

    renderBar() {
        this.bar = document.createElement('div'); this.bar.className = 'ink-v2-responsive-bar';
        this.bar.innerHTML = `
            <div class="ink-v2-viewport-devices">
                <button type="button" data-device="desktop" title="Desktop">▣</button>
                <button type="button" data-device="tablet" title="Tablet">▯</button>
                <button type="button" data-device="mobile" title="Mobile">▯</button>
            </div>
            <div class="ink-v2-viewport-scale"><button type="button" data-zoom="out">−</button><span data-scale>100%</span><button type="button" data-zoom="in">+</button><button type="button" data-zoom="reset">↶</button></div>
            <div class="ink-v2-viewport-size"><label>W <input type="number" data-width></label><label>H <input type="number" data-height></label><button type="button" data-close title="Close responsive mode">×</button></div>`;
        this.bar.querySelectorAll('[data-device]').forEach((button) => button.addEventListener('click', () => this.builder.setDevice(button.dataset.device)));
        this.bar.querySelector('[data-zoom="out"]').addEventListener('click', () => this.setScale(this.scale - .1));
        this.bar.querySelector('[data-zoom="in"]').addEventListener('click', () => this.setScale(this.scale + .1));
        this.bar.querySelector('[data-zoom="reset"]').addEventListener('click', () => this.setScale(1));
        this.bar.querySelector('[data-close]').addEventListener('click', () => this.builder.setDevice('desktop'));
        this.widthInput = this.bar.querySelector('[data-width]'); this.heightInput = this.bar.querySelector('[data-height]');
        this.widthInput.addEventListener('change', () => this.setSize(Number(this.widthInput.value), Number(this.heightInput.value)));
        this.heightInput.addEventListener('change', () => this.setSize(Number(this.widthInput.value), Number(this.heightInput.value)));
        this.container.prepend(this.bar);
    }

    renderHandles() {
        this.handles = ['w', 'e', 's'].map((edge) => { const handle = document.createElement('div'); handle.className = `ink-v2-viewport-handle is-${edge}`; handle.dataset.edge = edge; handle.addEventListener('pointerdown', (event) => this.startResize(event, edge)); this.container.appendChild(handle); return handle; });
    }

    setDevice(device) {
        this.device = device; this.container.dataset.inkViewportDevice = device;
        this.bar.querySelectorAll('[data-device]').forEach((button) => button.classList.toggle('is-active', button.dataset.device === device));
        const dimensions = DEFAULTS[device]; this.setScale(1);
        this.setSize(dimensions.width, dimensions.height);
        this.fitScale();
    }

    setSize(width, height) {
        width = Math.max(240, Math.min(1920, width || DEFAULTS[this.device].width)); height = Math.max(320, Math.min(2160, height || DEFAULTS[this.device].height));
        this.container.style.width = `${width}px`; this.container.style.height = `${height + 40}px`; this.builder.iframe.style.width = '100%'; this.builder.iframe.style.height = `${height}px`;
        this.widthInput.value = width; this.heightInput.value = height;
    }

    // Keep the device canvas visible without clipping: shrink the stage scale when the
    // requested device width exceeds the available editor stage.
    fitScale() {
        const stage = this.container.parentElement;
        if (!stage) return;
        const stageWidth = stage.clientWidth;
        const contentWidth = this.container.getBoundingClientRect().width || 1;
        if (contentWidth <= stageWidth) { this.setScale(1); return; }
        this.setScale(Math.max(.4, (stageWidth - 24) / contentWidth));
    }

    setScale(value) {
        this.scale = Math.max(.25, Math.min(2, Math.round(value * 10) / 10));
        this.container.style.setProperty('--ink-preview-scale', this.scale); this.bar.querySelector('[data-scale]').textContent = `${Math.round(this.scale * 100)}%`;
    }

    startResize(event, edge) {
        if (this.device === 'desktop') return;
        event.preventDefault(); const startX = event.clientX, startY = event.clientY, width = Number(this.widthInput.value), height = Number(this.heightInput.value);
        const move = (pointer) => { const deltaX = pointer.clientX - startX; const nextWidth = edge === 'e' ? width + deltaX * 2 : edge === 'w' ? width - deltaX * 2 : width; const nextHeight = edge === 's' ? height + (pointer.clientY - startY) : height; this.setSize(nextWidth, nextHeight); };
        const stop = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', stop); };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', stop);
    }
}
