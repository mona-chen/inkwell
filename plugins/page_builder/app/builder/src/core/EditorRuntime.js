import EventBus from './EventBus.js';
import ElementRegistry from './ElementRegistry.js';
import EditorDocument from './EditorDocument.js';
import CommandHistory from './CommandHistory.js';
import ResponsiveManager from './ResponsiveManager.js';
import StyleEngine from './StyleEngine.js';
import ControlRegistry from './ControlRegistry.js';
import SelectionManager from './SelectionManager.js';
import CanvasRenderer from './CanvasRenderer.js';
import registerInkFoundationElements from './inkFoundationElements.js';
import registerInkMagicElements from './inkMagicElements.js';
import registerInkElements from './inkElements.js';
import PanelManager from './PanelManager.js';
import * as controlsModule from './controls/index.js';
import DragDropManager from './DragDropManager.js';
import ContextMenuManager from './ContextMenuManager.js';

export default class EditorRuntime {
    constructor(data = {}) {
        this.events = new EventBus();
        this.elements = registerInkMagicElements(registerInkElements(registerInkFoundationElements(new ElementRegistry())));
        this.controls = new ControlRegistry();
        this.responsive = new ResponsiveManager({ events: this.events, breakpoints: data.settings?.breakpoints });
        this.document = new EditorDocument({ registry: this.elements, events: this.events, data });
        this.history = new CommandHistory({ events: this.events });
        this.selection = new SelectionManager({ document: this.document, events: this.events });
        this.styles = new StyleEngine({ registry: this.elements, responsive: this.responsive, events: this.events });
        this.canvas = new CanvasRenderer({ registry: this.elements, document: this.document, styles: this.styles, selection: this.selection, events: this.events });
        this.clipboard = null;
        this.styleClipboard = null;
        this.events.on('element:action', ({ action, id }) => this.performElementAction(action, id));
        this.events.on('element:inline-change', ({ id, text }) => this.update(id, { settings: { text } }, 'Edit text'));
        this.events.on('element:insert-structure', ({ parentId, structure }) => this.insertStructureAt(parentId, structure));
        this.events.on('element:resize', ({ id, structure }) => {
            if (!id || !structure) return;
            const node = this.document.get(id);
            if (node && node.type === 'columns') this.update(id, { settings: { structure } }, 'Resize columns');
        });
        this.registerControls();
    }

    // Panel control renderers, composably registered so PanelManager stays thin. Each
    // renderer is an independent module with the uniform contract
    // (panel, control, node, value, row) => row.
    registerControls() {
        const controls = this.controls;
        controls.register('media', controlsModule.media);
        controls.register('gallery', controlsModule.gallery);
        controls.register('repeater', controlsModule.repeater);
        controls.register('box-shadow', controlsModule.shadow);
        controls.register('text-shadow', controlsModule.shadow);
        controls.register('url', controlsModule.url);
        controls.register('icon', controlsModule.icon);
        controls.register('icons', controlsModule.icon);
        controls.register('border', controlsModule.border);
        controls.register('wysiwyg', controlsModule.wysiwyg);
        controls.register('image-dimensions', controlsModule.imageDimensions);
        controls.register('color', controlsModule.color);
        controls.register('css-filters', controlsModule.cssFilters);
        controls.register('text-stroke', controlsModule.textStroke);
        controls.register('gradient', controlsModule.gradient);
        controls.register('switcher', controlsModule.switcher);
        controls.register('slider', controlsModule.slider);
        controls.register('gaps', controlsModule.gaps);
        controls.register('dimensions', controlsModule.dimensions);
        controls.register('background', controlsModule.background);
        controls.register('shape-divider', controlsModule.shapeDivider);
        controls.register('typography', controlsModule.typography);
        controls.register('structure', controlsModule.structure);
        controls.register('popover-toggle', controlsModule.popoverToggle);
        ['heading', 'divider', 'raw-html', 'notice', 'alert'].forEach((type) => controls.register(type, controlsModule.notice));
        controls.register('button', controlsModule.actionButton);
        controls.register('hidden', controlsModule.hidden);
    }

    create(type, overrides) { return this.elements.create(type, overrides); }
    mount(root, { panel, settingsPanel } = {}) {
        this.canvas.mount(root);
        if (panel) {
            this.panel = new PanelManager({ runtime: this, container: panel, role: 'main' }).mount();
            this.dragDrop = new DragDropManager({ runtime: this, canvas: root, library: panel }).mount();
        }
        if (settingsPanel) this.settingsPanel = new PanelManager({ runtime: this, container: settingsPanel, role: 'settings' }).mount();
        this.contextMenu = new ContextMenuManager({ runtime: this, canvas: root }).mount();
        return this;
    }

    insert(type, target = {}, overrides = {}) {
        const node = this.create(type, overrides);
        this.history.execute({
            label: `Add ${this.elements.get(type).title}`,
            do: () => this.document.insert(node, target),
            undo: () => this.document.remove(node.id),
        });
        return node;
    }

    update(id, patch, label = 'Change settings') {
        const before = structuredClone(this.document.get(id));
        this.history.execute({
            label,
            do: () => this.document.update(id, patch),
            undo: () => { const node = this.document.get(id); node.settings = before.settings; node.styles = before.styles; this.events.emit('document:update', { id, patch: before }); },
        });
    }

    updateDocumentSettings(patch, label = 'Change page settings') {
        const before = structuredClone(this.document.data.settings);
        this.history.execute({
            label,
            do: () => {
                this.document.updateSettings(patch);
                if (patch.breakpoints) this.responsive.breakpoints = { ...this.responsive.breakpoints, ...patch.breakpoints };
            },
            undo: () => {
                this.document.data.settings = before;
                this.responsive.breakpoints = { ...before.breakpoints };
                this.events.emit('document:settings', { settings: structuredClone(before) });
            },
        });
    }

    remove(id) {
        const node = this.document.get(id);
        if (!node) return false;
        const selectedPath = this.selection.selectedId ? this.document.pathTo(this.selection.selectedId) : [];
        const parent = this.document.parentOf(id);
        const siblings = parent ? parent.children : this.document.data.children;
        const origin = { parentId: parent?.id || null, index: siblings.findIndex((child) => child.id === id) };
        this.history.execute({ label: 'Delete element', do: () => this.document.remove(id), undo: () => this.document.insert(node, origin) });
        if (selectedPath.some((ancestor) => ancestor.id === id)) this.selection.clear();
        return true;
    }

    removeMany(ids) {
        const unique = [...new Set(ids)].filter((id) => this.document.get(id));
        const roots = unique.filter((id) => !this.document.pathTo(id).slice(0, -1).some((node) => unique.includes(node.id)));
        if (!roots.length) return false;
        const before = this.serialize();
        this.history.execute({ label: `Delete ${roots.length} element${roots.length === 1 ? '' : 's'}`, do: () => roots.forEach((id) => this.document.remove(id)), undo: () => this.document.replace(before) });
        this.selection.clear(); return true;
    }

    move(id, target) {
        const parent = this.document.parentOf(id);
        const siblings = parent ? parent.children : this.document.data.children;
        const origin = { parentId: parent?.id || null, index: siblings.findIndex((node) => node.id === id) };
        this.history.execute({
            label: 'Move element',
            do: () => this.document.move(id, target),
            undo: () => {
                const currentParent = this.document.parentOf(id);
                const currentSiblings = currentParent ? currentParent.children : this.document.data.children;
                const currentIndex = currentSiblings.findIndex((node) => node.id === id);
                const insertionIndex = origin.index + (origin.parentId === (currentParent?.id || null) && currentIndex < origin.index ? 1 : 0);
                this.document.move(id, { parentId: origin.parentId, index: insertionIndex });
            },
        });
    }

    duplicate(id) {
        const source = this.document.get(id);
        if (!source) return null;
        const regenerate = (node) => ({ ...structuredClone(node), id: crypto.randomUUID(), ...(node.children ? { children: node.children.map(regenerate) } : {}) });
        const copy = regenerate(source);
        const parent = this.document.parentOf(id);
        const siblings = parent ? parent.children : this.document.data.children;
        const index = siblings.findIndex((node) => node.id === id) + 1;
        this.history.execute({ label: 'Duplicate element', do: () => this.document.insert(copy, { parentId: parent?.id || null, index }), undo: () => this.document.remove(copy.id) });
        this.selection.select(copy.id);
        return copy;
    }

    copy(id) { const node = this.document.get(id); this.clipboard = node ? structuredClone(node) : null; }
    copyStyles(id) { const node = this.document.get(id); this.styleClipboard = node ? structuredClone(node.styles) : null; }
    pasteStyles(id) { if (this.styleClipboard && this.document.get(id)) this.update(id, { styles: structuredClone(this.styleClipboard) }, 'Paste styles'); }
    resetStyles(id) { const node = this.document.get(id); if (node) this.update(id, { styles: this.create(node.type).styles }, 'Reset styles'); }

    paste(targetId = null) {
        if (!this.clipboard) return null;
        const regenerate = (node) => ({ ...structuredClone(node), id: crypto.randomUUID(), ...(node.children ? { children: node.children.map(regenerate) } : {}) });
        const copy = regenerate(this.clipboard);
        const target = targetId ? this.document.get(targetId) : null;
        const insertion = target && this.elements.accepts(target, copy) ? { parentId: target.id } : {};
        this.history.execute({ label: 'Paste element', do: () => this.document.insert(copy, insertion), undo: () => this.document.remove(copy.id) });
        this.selection.select(copy.id); return copy;
    }

    performElementAction(action, id) {
        if (action === 'edit') this.selection.select(id);
        if (action === 'add') { this.selection.select(id); this.events.emit('library:open', { parentId: id }); }
        if (action === 'duplicate') this.duplicate(id);
        if (action === 'copy') this.copy(id);
        if (action === 'paste') this.paste(id);
        if (action === 'copy-styles') this.copyStyles(id);
        if (action === 'paste-styles') this.pasteStyles(id);
        if (action === 'reset-styles') this.resetStyles(id);
        if (action === 'delete') this.remove(id);
    }

    // Insert a section pre-filled with an Ink column structure (e.g. "50,50").
    insertSection(structure = '50,50') {
        const section = this.create('section');
        this.history.execute({ label: 'Add section', do: () => this.document.insert(section, {}), undo: () => this.document.remove(section.id) });
        const columns = this.create('columns', { settings: { structure }, children: String(structure).split(',').map(() => this.create('column')) });
        this.history.execute({ label: 'Add columns', do: () => this.document.insert(columns, { parentId: section.id }), undo: () => this.document.remove(columns.id) });
        this.selection.select(section.id);
        return section;
    }

    // Insert a column structure into an existing container (empty-container "Add structure").
    insertStructureAt(parentId, structure = '50,50') {
        if (!parentId) return this.insertSection(structure);
        const parent = this.document.get(parentId);
        if (!parent) return null;
        const columns = this.create('columns', { settings: { structure }, children: String(structure).split(',').map(() => this.create('column')) });
        this.history.execute({ label: 'Add columns', do: () => this.document.insert(columns, { parentId, index: parent.children?.length || 0 }), undo: () => this.document.remove(columns.id) });
        this.selection.select(columns.id);
        return columns;
    }

    serialize() { return this.document.serialize(); }
}
