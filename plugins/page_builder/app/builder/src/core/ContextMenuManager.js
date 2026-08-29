export default class ContextMenuManager {
    constructor({ runtime, canvas } = {}) {
        this.runtime = runtime;
        this.canvas = canvas;
        this.document = canvas.ownerDocument;
        this.hostDocument = this.document.defaultView?.frameElement?.ownerDocument || null;
        this.onContextMenu = this.onContextMenu.bind(this);
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.close = this.close.bind(this);
    }

    mount() {
        this.canvas.addEventListener('contextmenu', this.onContextMenu);
        this.document.addEventListener('pointerdown', this.onPointerDown, true);
        this.document.addEventListener('keydown', this.onKeyDown);
        this.document.defaultView?.addEventListener('scroll', this.close, true);
        this.document.defaultView?.addEventListener('resize', this.close);
        // The menu lives inside the canvas iframe. A click in the app bar or panel is
        // therefore in another document and never bubbles into the canvas document.
        this.hostDocument?.addEventListener('pointerdown', this.close, true);
        this.hostDocument?.addEventListener('keydown', this.onKeyDown);
        return this;
    }

    onPointerDown(event) {
        if (this.menu && !this.menu.contains(event.target)) this.close();
    }

    onKeyDown(event) { if (event.key === 'Escape') this.close(); }

    onContextMenu(event) {
        const element = event.target.closest('[data-ink-element-id]');
        if (!element) return;
        event.preventDefault(); event.stopPropagation();
        const id = element.dataset.inkElementId;
        // Keep an existing multi-selection intact so right-click actions can act on it.
        if (!this.runtime.selection.selectedIds.has(id)) this.runtime.selection.select(id);
        const selectedIds = [...this.runtime.selection.selectedIds];
        const canFrame = this.runtime.canFrameSelection(selectedIds);
        const node = this.runtime.document.get(id);
        this.close();
        const menu = this.document.createElement('div'); menu.className = 'ink-editor-context-menu'; menu.dataset.inkEditorOnly = '';
        const actions = [
            ['edit', 'edit', 'Edit'], ['copy', 'content_copy', 'Copy'], ['paste', 'content_paste', 'Paste'],
            ['duplicate', 'control_point_duplicate', 'Duplicate'], ['copy-styles', 'format_paint', 'Copy styles'],
            ['paste-styles', 'format_color_fill', 'Paste styles'], ['reset-styles', 'restart_alt', 'Reset styles'],
            ...(canFrame ? [['frame', 'crop', 'Frame selected layers'], ['group', 'group', 'Group selected layers']] : []),
            ...(node?.type === 'frame' && node.settings?.frameSelection ? [['unframe', 'ungroup', 'Unframe']] : []),
            ['delete', 'delete', 'Delete'],
        ];
        actions.forEach(([action, icon, label]) => {
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
    destroy() {
        this.close();
        this.canvas.removeEventListener('contextmenu', this.onContextMenu);
        this.document.removeEventListener('pointerdown', this.onPointerDown, true);
        this.document.removeEventListener('keydown', this.onKeyDown);
        this.document.defaultView?.removeEventListener('scroll', this.close, true);
        this.document.defaultView?.removeEventListener('resize', this.close);
        this.hostDocument?.removeEventListener('pointerdown', this.close, true);
        this.hostDocument?.removeEventListener('keydown', this.onKeyDown);
    }
}
