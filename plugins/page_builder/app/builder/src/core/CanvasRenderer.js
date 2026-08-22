export default class CanvasRenderer {
    constructor({ registry, document, styles, selection, events } = {}) {
        this.registry = registry;
        this.document = document;
        this.styles = styles;
        this.selection = selection;
        this.events = events;
        this.instances = new Map();
        this.root = null;
        this.unsubscribers = [];
    }

    mount(root) {
        this.root = root;
        this.unsubscribers.push(this.events.on('document:insert', () => this.render()));
        this.unsubscribers.push(this.events.on('document:remove', ({ node }) => this.unmountTree(node)));
        this.unsubscribers.push(this.events.on('document:remove', () => this.render()));
        this.unsubscribers.push(this.events.on('document:move', () => this.render()));
        this.unsubscribers.push(this.events.on('document:update', ({ id }) => this.renderNode(id)));
        this.unsubscribers.push(this.events.on('document:settings', () => this.styles.mount(this.root.ownerDocument, this.document)));
        this.unsubscribers.push(this.events.on('document:replace', () => this.render()));
        this.render();
        return this;
    }

    create(node) {
        const definition = this.registry.get(node.type);
        const element = definition.render({ document: this.document, domDocument: this.root.ownerDocument, selection: this.selection }, node);
        if (!(element instanceof this.root.ownerDocument.defaultView.Element)) throw new Error(`${node.type}.render() must return a DOM Element.`);
        const kind = definition.kind || (definition.acceptsChildren ? (node.type === 'section' ? 'section' : node.type === 'column' ? 'column' : 'container') : 'widget');
        element.classList.add('ink-element', `ink-el-${node.id}`);
        element.dataset.inkElementId = node.id;
        element.dataset.inkElementType = node.type;
        element.dataset.inkKind = kind;
        element.draggable = true;
        element.addEventListener('click', (event) => { event.stopPropagation(); this.selection.select(node.id, { additive: event.shiftKey || event.metaKey || event.ctrlKey }); });
        element.addEventListener('pointerenter', () => this.selection.hover(node.id));
        element.addEventListener('pointerleave', () => this.selection.hover(null));
        if (definition.inlineEditable) element.addEventListener('dblclick', (event) => this.startInlineEditing(event, element, node, definition));
        const childrenRoot = element.querySelector('[data-ink-children]') || element;
        (node.children || []).forEach((child) => childrenRoot.appendChild(this.create(child)));
        if (!node.children?.length && definition.acceptsChildren) childrenRoot.appendChild(this.emptyView(node, kind));
        element.appendChild(this.overlay(node, kind));
        const instance = { element, definition, node };
        this.instances.set(node.id, instance);
        definition.mount?.({ element, node, document: this.document });
        return element;
    }

    render() {
        if (!this.root) return;
        this.instances.forEach(({ definition, element, node }) => definition.unmount?.({ element, node }));
        this.instances.clear();
        this.root.replaceChildren(...this.document.data.children.map((node) => this.create(node)));
        if (!this.document.data.children.length) this.root.appendChild(this.rootEmptyView());
        this.styles.mount(this.root.ownerDocument, this.document);
        this.events.emit('canvas:render', { root: this.root });
    }

    actionButton(icon, label, action, id) {
        const button = this.root.ownerDocument.createElement('button');
        button.type = 'button'; button.title = label; button.dataset.inkAction = action;
        if (action === 'edit' && icon === 'drag_indicator') button.draggable = true;
        button.setAttribute('aria-label', label);
        button.textContent = ({ drag_indicator: '↕', edit: '✎', add: '+', duplicate: '⧉', delete: '×' })[icon] || '•';
        button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.events.emit('element:action', { action, id }); });
        return button;
    }

    overlay(node, kind) {
        const overlay = this.root.ownerDocument.createElement('div'); overlay.className = 'ink-editor-overlay'; overlay.dataset.inkEditorOnly = ''; overlay.contentEditable = 'false';
        const toolbar = this.root.ownerDocument.createElement('div'); toolbar.className = 'ink-editor-toolbar';
        const actions = kind === 'section' ? ['drag_indicator', 'edit', 'duplicate', 'delete', 'add'] : ['drag_indicator', 'edit', 'add', 'duplicate', 'delete'];
        actions.forEach((action) => toolbar.appendChild(this.actionButton(action, ({ drag_indicator: 'Move', edit: 'Edit', add: 'Add element', duplicate: 'Duplicate', delete: 'Delete' })[action], action, node.id)));
        overlay.appendChild(toolbar); return overlay;
    }

    // Ink structure presets for the empty-surface "Add structure" action.
    structurePresets(parentId) {
        const presets = [['Single', '100'], ['1/2 · 1/2', '50,50'], ['1/3 · 1/3 · 1/3', '33,33,33'], ['1/4 × 4', '25,25,25,25'], ['30 / 70', '30,70'], ['70 / 30', '70,30'], ['25 / 50 / 25', '25,50,25']];
        const doc = this.root.ownerDocument;
        const popover = doc.createElement('div'); popover.className = 'ink-structure-popover'; popover.hidden = true;
        presets.forEach(([label, structure]) => {
            const button = doc.createElement('button'); button.type = 'button';
            button.innerHTML = `<span class="ink-structure-preset-bars">${structure.split(',').map((w) => `<i style="flex:${w}"></i>`).join('')}</span><span>${label}</span>`;
            button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); popover.hidden = true; this.events.emit('element:insert-structure', { parentId, structure }); });
            popover.appendChild(button);
        });
        return popover;
    }

    emptyActionRow(parentId) {
        const doc = this.root.ownerDocument;
        const actions = doc.createElement('div'); actions.className = 'ink-empty-actions';
        const add = doc.createElement('button'); add.type = 'button'; add.className = 'ink-empty-action'; add.dataset.emptyAction = 'add'; add.title = 'Add element'; add.setAttribute('aria-label', 'Add element'); add.innerHTML = '<span class="material-symbols-rounded">add</span>';
        add.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); this.events.emit('element:action', { action: 'add', id: parentId }); });
        const structure = doc.createElement('button'); structure.type = 'button'; structure.className = 'ink-empty-action'; structure.dataset.emptyAction = 'structure'; structure.title = 'Add container / structure'; structure.setAttribute('aria-label', 'Add container or structure'); structure.innerHTML = '<span class="material-symbols-rounded">view_column</span>';
        structure.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); const popover = actions.parentElement.querySelector('.ink-structure-popover'); if (popover) popover.hidden = !popover.hidden; });
        actions.append(add, structure);
        return actions;
    }

    emptyView(node, kind) {
        const doc = this.root.ownerDocument;
        const view = doc.createElement('div'); view.className = 'ink-editor-empty'; view.dataset.inkEditorOnly = '';
        view.appendChild(this.emptyActionRow(node.id));
        const caption = doc.createElement('span'); caption.className = 'ink-empty-caption'; caption.textContent = 'Drag widgets here'; view.appendChild(caption);
        view.appendChild(this.structurePresets(node.id));
        return view;
    }

    rootEmptyView() {
        const doc = this.root.ownerDocument;
        const view = doc.createElement('div'); view.className = 'ink-editor-root-empty'; view.dataset.inkEditorOnly = '';
        view.appendChild(this.emptyActionRow(null));
        const caption = doc.createElement('span'); caption.className = 'ink-empty-caption'; caption.textContent = 'Drag widgets here'; view.appendChild(caption);
        view.appendChild(this.structurePresets(null));
        return view;
    }

    startInlineEditing(event, element, node, definition) {
        event.preventDefault(); event.stopPropagation();
        const target = typeof definition.inlineEditable === 'string' && definition.inlineEditable !== 'text' ? element.querySelector(definition.inlineEditable) : element;
        if (!target || target.dataset.inkInlineEditing === 'true') return;
        const original = node.settings.text || ''; target.dataset.inkInlineEditing = 'true'; target.contentEditable = 'true'; element.draggable = false; this.selection.select(node.id); target.focus();
        const selection = target.ownerDocument.getSelection(); const range = target.ownerDocument.createRange(); const textNode = [...target.childNodes].find((child) => child.nodeType === Node.TEXT_NODE); textNode ? range.selectNodeContents(textNode) : range.selectNodeContents(target); selection.removeAllRanges(); selection.addRange(range);
        const readText = () => { const clone = target.cloneNode(true); clone.querySelectorAll('[data-ink-editor-only]').forEach((item) => item.remove()); return clone.textContent; };
        const finish = (commit = true) => { if (target.dataset.inkInlineEditing !== 'true') return; delete target.dataset.inkInlineEditing; target.removeAttribute('contenteditable'); element.draggable = true; const text = readText(); if (commit && text !== original) this.events.emit('element:inline-change', { id: node.id, text }); else if (!commit) { [...target.childNodes].filter((child) => !child.dataset?.inkEditorOnly).forEach((child) => child.remove()); target.prepend(target.ownerDocument.createTextNode(original)); } };
        target.addEventListener('blur', () => finish(true), { once: true });
        target.addEventListener('keydown', (keyEvent) => { if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); finish(false); target.blur(); } else if (keyEvent.key === 'Enter' && node.type === 'heading' && !keyEvent.shiftKey) { keyEvent.preventDefault(); target.blur(); } });
    }

    renderNode(id) {
        const instance = this.instances.get(id);
        const node = this.document.get(id);
        if (!instance || !node) return this.render();
        const replacement = this.create(node);
        instance.definition.unmount?.({ element: instance.element, node: instance.node });
        instance.element.replaceWith(replacement);
        this.styles.mount(this.root.ownerDocument, this.document);
        this.events.emit('canvas:update', { id, element: replacement });
    }

    unmountTree(node) {
        (node.children || []).forEach((child) => this.unmountTree(child));
        const instance = this.instances.get(node.id);
        instance?.definition.unmount?.({ element: instance.element, node: instance.node });
        this.instances.delete(node.id);
    }

    destroy() {
        this.unsubscribers.forEach((unsubscribe) => unsubscribe());
        this.unsubscribers = [];
        this.document.data.children.forEach((node) => this.unmountTree(node));
        this.root = null;
    }
}
