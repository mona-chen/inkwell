import PanelManager from './PanelManager.js';

const lucideIcon = (name) => {
    const paths = {
        panelRight: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
        externalLink: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    };
    return `<svg class="ink-structure-lucide" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
};

// Floating Navigator panel. Toggled from the top bar, it lives over the canvas in the
// upper-right, below the app bar, and stays independent of the left panel. Selection and tree
// rows stay synchronized through the document events the nested PanelManager subscribes to.
export default class NavigatorManager {
    constructor(runtime) {
        this.runtime = runtime;
        this.window = null;
        this.panel = null;
        this.docked = false;
        this.floatingGeometry = null;
        this.onVisibilityChange = null;
    }

    mount() {
        this.window = document.createElement('aside'); this.window.className = 'ink-structure-window'; this.window.hidden = true;
        const header = document.createElement('header'); header.className = 'ink-structure-window-header';
        header.innerHTML = `<strong>Navigator</strong><span class="ink-structure-window-actions"><button type="button" data-dock title="Dock Navigator" aria-label="Dock Navigator">${lucideIcon('panelRight')}</button><button type="button" data-close title="Close Navigator" aria-label="Close Navigator">${lucideIcon('close')}</button></span>`;
        const host = document.createElement('div'); host.className = 'ink-structure-window-body';
        const resize = document.createElement('div'); resize.className = 'ink-structure-window-resize';
        this.window.append(header, host, resize); document.body.appendChild(this.window);
        this.panel = new PanelManager({ runtime: this.runtime, container: host, role: 'navigator' }).mount();
        header.querySelector('[data-close]').addEventListener('click', () => this.hide());
        header.querySelector('[data-dock]').addEventListener('click', () => this.setDocked(!this.docked));
        header.addEventListener('pointerdown', (event) => this.startDrag(event));
        resize.addEventListener('pointerdown', (event) => this.startResize(event));
        this.restorePrefs();
        return this;
    }

    restorePrefs() {
        try {
            const prefs = JSON.parse(localStorage.getItem('inkwell_builder_navigator') || '{}');
            if (prefs.docked) this.docked = true;
            this.floatingGeometry = {
                left: Number(prefs.left) || null,
                top: Number(prefs.top) || null,
                width: Number(prefs.width) || null,
                height: Number(prefs.height) || null,
            };
            if (!this.docked) this.applyFloatingGeometry();
            this.window.classList.toggle('is-docked', this.docked);
            if (this.docked) this.clearInlineGeometry();
            this.updateDockButton();
        } catch (_) {}
    }

    savePrefs() {
        try {
            if (!this.docked) this.captureFloatingGeometry();
            const geometry = this.floatingGeometry || {};
            localStorage.setItem('inkwell_builder_navigator', JSON.stringify({
                docked: this.docked,
                left: geometry.left == null ? null : Math.round(geometry.left),
                top: geometry.top == null ? null : Math.round(geometry.top),
                width: geometry.width == null ? null : Math.round(geometry.width),
                height: geometry.height == null ? null : Math.round(geometry.height),
            }));
        } catch (_) {}
    }

    isOpen() { return !this.window.hidden; }

    toggle() {
        this.window.hidden ? this.show() : this.hide();
        this.onVisibilityChange?.(this.isOpen());
        return this.isOpen();
    }
    show() {
        this.window.hidden = false;
        this.ensureInViewport();
        document.body.classList.toggle('ink-structure-docked', this.docked);
        this.onVisibilityChange?.(true);
    }
    hide() {
        this.window.hidden = true;
        document.body.classList.remove('ink-structure-docked');
        this.onVisibilityChange?.(false);
    }
    setDocked(docked) {
        if (docked === this.docked) return;
        if (docked) this.captureFloatingGeometry();
        this.docked = docked;
        this.window.classList.toggle('is-docked', docked);
        if (docked) {
            this.clearInlineGeometry();
        } else {
            this.applyFloatingGeometry();
            this.ensureInViewport();
        }
        document.body.classList.toggle('ink-structure-docked', docked && !this.window.hidden);
        this.updateDockButton();
        this.savePrefs();
    }
    captureFloatingGeometry() {
        if (!this.window || this.window.hidden || this.docked) return;
        const rect = this.window.getBoundingClientRect();
        this.floatingGeometry = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
        };
    }
    applyFloatingGeometry() {
        const geometry = this.floatingGeometry;
        if (!this.window || !geometry) return;
        if (geometry.left != null) this.window.style.left = `${geometry.left}px`;
        if (geometry.top != null) this.window.style.top = `${geometry.top}px`;
        if (geometry.width != null) this.window.style.width = `${geometry.width}px`;
        if (geometry.height != null) this.window.style.height = `${geometry.height}px`;
        this.window.style.right = 'auto';
        this.window.style.bottom = 'auto';
    }
    clearInlineGeometry() {
        if (!this.window) return;
        ['left', 'right', 'top', 'bottom', 'width', 'height'].forEach((property) => {
            this.window.style.removeProperty(property);
        });
    }
    updateDockButton() {
        const button = this.window?.querySelector('[data-dock]');
        if (!button) return;
        const label = this.docked ? 'Float Navigator' : 'Dock Navigator';
        button.title = label;
        button.setAttribute('aria-label', label);
        button.innerHTML = lucideIcon(this.docked ? 'externalLink' : 'panelRight');
    }
    ensureInViewport() {
        if (this.docked || !this.window) return;
        const appbarBottom = 52;
        const gutter = 8;
        const maxWidth = Math.max(220, window.innerWidth - gutter * 2);
        const maxHeight = Math.max(220, window.innerHeight - appbarBottom - gutter);
        const rect = this.window.getBoundingClientRect();
        const width = Math.min(rect.width || 264, maxWidth);
        const height = Math.min(rect.height || 420, maxHeight);
        let left = rect.left;
        let top = rect.top;

        if (!Number.isFinite(left) || left < gutter || left + width > window.innerWidth - gutter) {
            left = Math.max(gutter, window.innerWidth - width - 16);
        }
        if (!Number.isFinite(top) || top < appbarBottom || top + height > window.innerHeight - gutter) {
            top = Math.max(appbarBottom, Math.min(top || appbarBottom, window.innerHeight - height - gutter));
        }

        this.window.style.width = `${width}px`;
        this.window.style.height = `${height}px`;
        this.window.style.left = `${left}px`;
        this.window.style.right = 'auto';
        this.window.style.top = `${top}px`;
    }
    startDrag(event) {
        if (this.docked || event.target.closest('button')) return;
        event.preventDefault();
        const rect = this.window.getBoundingClientRect(), startX = event.clientX, startY = event.clientY;
        const move = (pointer) => {
            this.window.style.left = `${Math.max(0, rect.left + pointer.clientX - startX)}px`;
            this.window.style.top = `${Math.max(52, rect.top + pointer.clientY - startY)}px`;
            this.window.style.right = 'auto';
        };
        const stop = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', stop); this.savePrefs(); };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', stop);
    }
    startResize(event) {
        if (this.docked) return;
        event.preventDefault();
        const rect = this.window.getBoundingClientRect(), startX = event.clientX, startY = event.clientY;
        const move = (pointer) => {
            this.window.style.width = `${Math.max(220, Math.min(520, rect.width + pointer.clientX - startX))}px`;
            this.window.style.height = `${Math.max(220, Math.min(window.innerHeight - 56, rect.height + pointer.clientY - startY))}px`;
        };
        const stop = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', stop); this.savePrefs(); };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', stop);
    }
    destroy() {
        this.panel?.destroy();
        this.window?.remove();
        document.body.classList.remove('ink-structure-docked');
    }
}
