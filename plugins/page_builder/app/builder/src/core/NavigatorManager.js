import PanelManager from './PanelManager.js';

// Floating "Structure" panel. Toggled from the top bar, it lives over the canvas in the
// upper-right, below the app bar, and stays independent of the left panel. Selection and tree
// rows stay synchronized through the document events the nested PanelManager subscribes to.
export default class NavigatorManager {
    constructor(runtime) {
        this.runtime = runtime;
        this.window = null;
        this.panel = null;
        this.docked = false;
        this.onVisibilityChange = null;
    }

    mount() {
        this.window = document.createElement('aside'); this.window.className = 'ink-structure-window'; this.window.hidden = true;
        const header = document.createElement('header'); header.className = 'ink-structure-window-header';
        header.innerHTML = '<strong>Structure</strong><span class="ink-structure-window-actions"><button type="button" data-dock title="Dock Structure" aria-label="Dock Structure"><span class="material-symbols-rounded">dock_to_right</span></button><button type="button" data-close title="Close Structure" aria-label="Close Structure"><span class="material-symbols-rounded">close</span></button></span>';
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
            if (prefs.left) { this.window.style.left = `${prefs.left}px`; this.window.style.right = 'auto'; }
            if (prefs.top) this.window.style.top = `${prefs.top}px`;
            if (prefs.width) this.window.style.width = `${prefs.width}px`;
            if (prefs.height) this.window.style.height = `${prefs.height}px`;
            this.window.classList.toggle('is-docked', this.docked);
        } catch (_) {}
    }

    savePrefs() {
        try {
            const rect = this.window.getBoundingClientRect();
            localStorage.setItem('inkwell_builder_navigator', JSON.stringify({
                docked: this.docked, left: Math.round(rect.left), top: Math.round(rect.top),
                width: Math.round(rect.width), height: Math.round(rect.height),
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
        document.body.classList.toggle('ink-structure-docked', this.docked);
        this.onVisibilityChange?.(true);
    }
    hide() {
        this.window.hidden = true;
        document.body.classList.remove('ink-structure-docked');
        this.onVisibilityChange?.(false);
    }
    setDocked(docked) {
        this.docked = docked;
        this.window.classList.toggle('is-docked', docked);
        document.body.classList.toggle('ink-structure-docked', docked && !this.window.hidden);
        this.window.querySelector('[data-dock] .material-symbols-rounded').textContent = docked ? 'open_in_new' : 'dock_to_right';
        this.savePrefs();
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
