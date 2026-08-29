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
        controls.register('imported-background', controlsModule.importedBackground);
        controls.register('motion', controlsModule.motion);
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
        controls.register('layout-flow', controlsModule.layoutFlow);
        controls.register('alignment-gap', controlsModule.alignmentGap);
        controls.register('resizing', controlsModule.resizing);
        controls.register('positioning', controlsModule.positioning);
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

    // Figma-style grouping is an organizational operation, not a way to create a new
    // layout box. Only sibling root selections can be grouped: that retains their order
    // and guarantees that grouping cannot silently alter the page's layout.
    canGroupSelection(ids = [...this.selection.selectedIds]) {
        const selected = [...new Set(ids)].map((id) => this.document.get(id)).filter(Boolean);
        const roots = selected.filter((node) => !this.document.pathTo(node.id).slice(0, -1).some((ancestor) => selected.some((candidate) => candidate.id === ancestor.id)));
        if (roots.length < 2) return false;
        const parent = this.document.parentOf(roots[0].id);
        return roots.every((node) => this.document.parentOf(node.id) === parent);
    }

    groupSelection(ids = [...this.selection.selectedIds]) {
        if (!this.canGroupSelection(ids)) return null;
        const selected = [...new Set(ids)].map((id) => this.document.get(id)).filter(Boolean);
        const roots = selected.filter((node) => !this.document.pathTo(node.id).slice(0, -1).some((ancestor) => selected.some((candidate) => candidate.id === ancestor.id)));
        const parent = this.document.parentOf(roots[0].id);
        const siblings = parent ? parent.children : this.document.data.children;
        const ordered = roots.slice().sort((a, b) => siblings.indexOf(a) - siblings.indexOf(b));
        const index = siblings.indexOf(ordered[0]);
        const group = this.create('group', { settings: { label: 'Group', grouping: true } });
        this.history.execute({
            label: `Group ${ordered.length} layers`,
            do: () => {
                group.children = ordered.map((node) => this.document.remove(node.id)?.node).filter(Boolean);
                this.document.insert(group, { parentId: parent?.id || null, index });
            },
            undo: () => {
                const restored = this.document.remove(group.id)?.node;
                (restored?.children || []).forEach((child, childIndex) => this.document.insert(child, { parentId: parent?.id || null, index: index + childIndex }));
            },
        });
        this.selection.select(group.id);
        return group;
    }

    ungroup(id = this.selection.selectedId) {
        const group = this.document.get(id);
        if (!group || group.type !== 'group' || !group.settings?.grouping || !(group.children || []).length) return false;
        const parent = this.document.parentOf(group.id);
        const siblings = parent ? parent.children : this.document.data.children;
        const index = siblings.indexOf(group);
        const children = group.children.slice();
        this.history.execute({
            label: `Ungroup ${children.length} layers`,
            do: () => {
                const source = this.document.remove(group.id)?.node;
                (source?.children || []).forEach((child, childIndex) => this.document.insert(child, { parentId: parent?.id || null, index: index + childIndex }));
            },
            undo: () => {
                children.forEach((child) => this.document.remove(child.id));
                group.children = children;
                this.document.insert(group, { parentId: parent?.id || null, index });
            },
        });
        this.selection.select(children.at(-1)?.id || null);
        return true;
    }

    canFrameSelection(ids = [...this.selection.selectedIds]) { return this.canGroupSelection(ids); }

    // Turn a sibling selection into a visual Frame. For freeform/absolute artwork we preserve
    // its measured bounding box and rebase children into the new containing block. For normal
    // flow content we retain child styles and use a Stack Frame, preserving web reflow instead
    // of freezing responsive content into coordinates.
    frameSelection(ids = [...this.selection.selectedIds]) {
        if (!this.canFrameSelection(ids)) return null;
        const selected = [...new Set(ids)].map((id) => this.document.get(id)).filter(Boolean);
        const roots = selected.filter((node) => !this.document.pathTo(node.id).slice(0, -1).some((ancestor) => selected.some((candidate) => candidate.id === ancestor.id)));
        const parent = this.document.parentOf(roots[0].id);
        const siblings = parent ? parent.children : this.document.data.children;
        const ordered = roots.slice().sort((a, b) => siblings.indexOf(a) - siblings.indexOf(b));
        const nodes = ordered.map((node) => this.canvas.instances.get(node.id)?.element).filter(Boolean);
        const parentElement = parent ? this.canvas.instances.get(parent.id)?.element : this.canvas.root;
        const childHost = parentElement?.querySelector?.(':scope > [data-ink-children]') || parentElement?.querySelector?.('[data-ink-children]') || parentElement;
        if (nodes.length !== ordered.length || !parentElement || !childHost) return null;
        const rects = nodes.map((element) => element.getBoundingClientRect());
        const parentRect = childHost.getBoundingClientRect();
        const originX = parentRect.left + childHost.clientLeft - childHost.scrollLeft;
        const originY = parentRect.top + childHost.clientTop - childHost.scrollTop;
        const minX = Math.min(...rects.map((rect) => rect.left)), minY = Math.min(...rects.map((rect) => rect.top));
        const maxX = Math.max(...rects.map((rect) => rect.right)), maxY = Math.max(...rects.map((rect) => rect.bottom));
        const positioned = nodes.every((element) => ['absolute', 'fixed'].includes(element.ownerDocument.defaultView.getComputedStyle(element).position));
        const frame = this.create('frame', { settings: { label: 'Frame', frameSelection: true } });
        const base = frame.styles.desktop.base;
        if (positioned) Object.assign(base, { position: nodes.some((element) => element.ownerDocument.defaultView.getComputedStyle(element).position === 'fixed') ? 'fixed' : 'absolute', left: { size: Math.round(minX - originX), unit: 'px' }, top: { size: Math.round(minY - originY), unit: 'px' }, width: { size: Math.round(maxX - minX), unit: 'px' }, height: { size: Math.round(maxY - minY), unit: 'px' }, display: 'block' });
        else {
            const parentStyles = childHost.ownerDocument.defaultView.getComputedStyle(childHost);
            const display = ['flex', 'grid'].includes(parentStyles.display) ? parentStyles.display : 'block';
            Object.assign(base, {
                display,
                width: 'fit-content',
                height: 'fit-content',
                ...(display === 'flex' ? { 'flex-direction': parentStyles.flexDirection, 'flex-wrap': parentStyles.flexWrap, 'justify-content': parentStyles.justifyContent, 'align-items': parentStyles.alignItems, gap: parentStyles.gap } : {}),
                ...(display === 'grid' ? { 'grid-template-columns': parentStyles.gridTemplateColumns, 'grid-template-rows': parentStyles.gridTemplateRows, 'grid-auto-flow': parentStyles.gridAutoFlow, gap: parentStyles.gap } : {}),
            });
        }
        const before = this.serialize();
        const after = structuredClone(before);
        const locate = (items, id) => { for (const item of items || []) { if (item.id === id) return item; const nested = locate(item.children, id); if (nested) return nested; } return null; };
        const targetParent = parent ? locate(after.children, parent.id) : after;
        const selectedIds = new Set(ordered.map((node) => node.id));
        const selectedChildren = targetParent.children.filter((child) => selectedIds.has(child.id));
        const index = targetParent.children.findIndex((child) => selectedIds.has(child.id));
        targetParent.children = targetParent.children.filter((child) => !selectedIds.has(child.id));
        if (positioned) selectedChildren.forEach((child, childIndex) => {
            const rect = rects[childIndex]; const childBase = child.styles.desktop.base;
            Object.assign(childBase, { position: 'absolute', left: { size: Math.round(rect.left - minX), unit: 'px' }, top: { size: Math.round(rect.top - minY), unit: 'px' } });
        });
        frame.children = selectedChildren;
        targetParent.children.splice(index, 0, frame);
        this.history.execute({ label: `Frame ${ordered.length} layers`, do: () => this.document.replace(after), undo: () => this.document.replace(before) });
        this.selection.select(frame.id);
        return this.document.get(frame.id);
    }

    unframe(id = this.selection.selectedId) {
        const frame = this.document.get(id);
        if (!frame || frame.type !== 'frame' || !frame.settings?.frameSelection || !(frame.children || []).length) return false;
        const parent = this.document.parentOf(frame.id);
        const before = this.serialize();
        const after = structuredClone(before);
        const locate = (items, targetId) => { for (const item of items || []) { if (item.id === targetId) return item; const nested = locate(item.children, targetId); if (nested) return nested; } return null; };
        const targetParent = parent ? locate(after.children, parent.id) : after;
        const index = targetParent.children.findIndex((child) => child.id === id);
        const source = targetParent.children[index];
        const frameBase = source.styles?.desktop?.base || {};
        const left = Number(frameBase.left?.size ?? frameBase.left) || 0, top = Number(frameBase.top?.size ?? frameBase.top) || 0;
        const positioned = ['absolute', 'fixed'].includes(frameBase.position);
        const children = source.children || [];
        if (positioned) children.forEach((child) => {
            const childBase = child.styles?.desktop?.base || {};
            if (['absolute', 'fixed'].includes(childBase.position)) {
                const childLeft = Number(childBase.left?.size ?? childBase.left) || 0, childTop = Number(childBase.top?.size ?? childBase.top) || 0;
                childBase.left = { size: left + childLeft, unit: 'px' }; childBase.top = { size: top + childTop, unit: 'px' };
            }
        });
        targetParent.children.splice(index, 1, ...children);
        this.history.execute({ label: `Unframe ${children.length} layers`, do: () => this.document.replace(after), undo: () => this.document.replace(before) });
        this.selection.select(children.at(-1)?.id || null);
        return true;
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
        if (action === 'frame') this.frameSelection();
        if (action === 'group') this.groupSelection();
        if (action === 'ungroup') this.ungroup(id);
        if (action === 'unframe') this.unframe(id);
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
