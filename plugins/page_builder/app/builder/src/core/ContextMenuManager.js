export default class ContextMenuManager {
    constructor({ runtime, canvas } = {}) {
        this.runtime = runtime;
        this.canvas = canvas;
        this.document = canvas.ownerDocument;
        this.onContextMenu = this.onContextMenu.bind(this);
        this.close = this.close.bind(this);
    }

    mount() {
        this.canvas.addEventListener('contextmenu', this.onContextMenu);
        this.document.addEventListener('click', this.close);
        this.document.addEventListener('keydown', (event) => { if (event.key === 'Escape') this.close(); });
        return this;
    }

    onContextMenu(event) {
        const element = event.target.closest('[data-ink-element-id]');
        if (!element) return;
        event.preventDefault(); event.stopPropagation();
        const id = element.dataset.inkElementId;
        this.runtime.selection.select(id); this.close();
        const menu = this.document.createElement('div'); menu.className = 'ink-editor-context-menu'; menu.dataset.inkEditorOnly = '';
        [
            ['edit', 'edit', 'Edit'], ['copy', 'content_copy', 'Copy'], ['paste', 'content_paste', 'Paste'],
            ['duplicate', 'control_point_duplicate', 'Duplicate'], ['copy-styles', 'format_paint', 'Copy styles'],
            ['paste-styles', 'format_color_fill', 'Paste styles'], ['reset-styles', 'restart_alt', 'Reset styles'], ['delete', 'delete', 'Delete'],
        ].forEach(([action, icon, label]) => {
            const button = this.document.createElement('button'); button.type = 'button'; button.dataset.action = action;
            button.disabled = (action === 'paste' && !this.runtime.clipboard) || (action === 'paste-styles' && !this.runtime.styleClipboard);
            const glyph = ({ edit: '✎', content_copy: '⧉', content_paste: '▣', control_point_duplicate: '⊕', format_paint: '◩', format_color_fill: '◪', restart_alt: '↶', delete: '×' })[icon] || '•';
            button.innerHTML = `<span aria-hidden="true">${glyph}</span><span>${label}</span>`;
            button.addEventListener('click', () => { this.runtime.performElementAction(action, id); this.close(); }); menu.appendChild(button);
        });
        this.document.body.appendChild(menu);
        const x = Math.min(event.clientX, this.document.defaultView.innerWidth - 190);
        const y = Math.min(event.clientY, this.document.defaultView.innerHeight - menu.offsetHeight - 8);
        menu.style.left = `${Math.max(8, x)}px`; menu.style.top = `${Math.max(8, y)}px`; this.menu = menu;
    }

    close() { this.menu?.remove(); this.menu = null; }
    destroy() { this.close(); this.canvas.removeEventListener('contextmenu', this.onContextMenu); this.document.removeEventListener('click', this.close); }
}
