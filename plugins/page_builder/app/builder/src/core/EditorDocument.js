const clone = (value) => structuredClone(value);
import { normalizeStyles, mergeStyles } from './StyleValueModel.js';

const BUTTON_SIZE_PRESETS = {
    xs: { fontSize: 13, padding: [10, 20], radius: 2 },
    sm: { fontSize: 15, padding: [12, 24], radius: 3 },
    md: { fontSize: 16, padding: [15, 30], radius: 4 },
    lg: { fontSize: 18, padding: [20, 40], radius: 5 },
    xl: { fontSize: 20, padding: [25, 50], radius: 6 },
};

export default class EditorDocument {
    constructor({ registry, events, data } = {}) {
        this.registry = registry;
        this.events = events;
        this.data = this.normalize(data);
        this.reindex();
    }

    normalize(data = {}) {
        const document = {
            version: 2,
            type: 'page',
            settings: {
                title: 'Blank',
                breakpoints: { desktop: null, tablet: 1024, mobile: 767 },
                theme: { colors: {}, typography: {}, spacing: {} },
                customCss: '', customJs: '',
                ...(clone(data.settings || {})),
            },
            children: clone(data.children || []),
        };
        if (data.version && data.version !== 2) throw new Error(`Unsupported builder document version: ${data.version}`);
        // Normalize old storage once at the document boundary. Runtime controls and renderers
        // only consume the canonical modern model after this point.
        const visit = (node) => {
            // Before Groups became selection-only layers they were emitted as 160px visual
            // boxes with surface controls. Keep those published designs intact by promoting
            // every legacy Group to the now-canonical visual primitive: Frame. New Groups
            // carry the explicit grouping marker and remain non-visual.
            if (node?.type === 'group' && node.settings?.grouping !== true) {
                const legacyBase = node.styles?.desktop?.base || node.styles?.base || {};
                const hasChildren = Boolean(node.children?.length);
                const hasSurface = Object.keys(legacyBase).some((property) => /^(background|border|box-shadow|filter|opacity|transform|clip-path|mask)/.test(property));
                // Discard abandoned, empty 160px placeholder Groups rather than preserving
                // their accidental footprint. Any Group that contains design content or owns
                // a visual surface is upgraded to a Frame so its output remains identical.
                if (!hasChildren && !hasSurface) {
                    node.settings = { label: node.settings?.label || 'Group', grouping: true };
                    node.styles = { base: { display: 'contents' } };
                } else {
                    node.type = 'frame';
                    node.settings = { ...(node.settings || {}), tag: node.settings?.tag || 'div' };
                    delete node.settings.grouping;
                }
            }
            if (node && node.styles && typeof node.styles === 'object') node.styles = normalizeStyles(node.styles);
            if (node?.type === 'button' && BUTTON_SIZE_PRESETS[node.settings?.size]) {
                const preset = BUTTON_SIZE_PRESETS[node.settings.size];
                const base = node.styles.desktop.base;
                if (!Object.hasOwn(base, 'font-size')) base['font-size'] = { size: preset.fontSize, unit: 'px' };
                if (!Object.hasOwn(base, 'padding')) base.padding = { top: preset.padding[0], right: preset.padding[1], bottom: preset.padding[0], left: preset.padding[1], unit: 'px', linked: false };
                if (!Object.hasOwn(base, 'border-radius')) base['border-radius'] = { size: preset.radius, unit: 'px' };
                node.settings = { ...node.settings };
                delete node.settings.size;
            }
            (node.children || []).forEach(visit);
        };
        document.children.forEach(visit);
        return document;
    }

    reindex() {
        this.index = new Map();
        const visit = (node, parent = null) => {
            if (!node.id) throw new Error('Every element node requires a stable id.');
            if (this.index.has(node.id)) throw new Error(`Duplicate element id: ${node.id}`);
            this.registry.get(node.type);
            this.index.set(node.id, { node, parent });
            (node.children || []).forEach((child) => visit(child, node));
        };
        this.data.children.forEach((node) => visit(node));
    }

    serialize() { return clone(this.data); }
    get(id) { return this.index.get(id)?.node || null; }
    parentOf(id) { return this.index.get(id)?.parent || null; }
    childrenOf(parentId = null) { return parentId ? (this.get(parentId)?.children || []) : this.data.children; }

    pathTo(id) {
        const path = [];
        let node = this.get(id);
        while (node) { path.unshift(node); node = this.parentOf(node.id); }
        return path;
    }

    insert(node, { parentId = null, index } = {}) {
        if (this.index.has(node.id)) throw new Error(`Duplicate element id: ${node.id}`);
        const parent = parentId ? this.get(parentId) : null;
        if (parent && !this.registry.accepts(parent, node)) throw new Error(`${parent.type} cannot contain ${node.type}`);
        const children = parent ? parent.children : this.data.children;
        const insertionIndex = index == null ? children.length : Math.max(0, Math.min(index, children.length));
        children.splice(insertionIndex, 0, node);
        this.reindex();
        this.emit('document:insert', { node, parentId, index: insertionIndex });
        return node;
    }

    remove(id) {
        const node = this.get(id);
        if (!node) return null;
        const parent = this.parentOf(id);
        const children = parent ? parent.children : this.data.children;
        const index = children.findIndex((child) => child.id === id);
        children.splice(index, 1);
        this.reindex();
        this.emit('document:remove', { node, parentId: parent?.id || null, index });
        return { node, parentId: parent?.id || null, index };
    }

    move(id, target) {
        const node = this.get(id);
        if (!node) throw new Error(`Unknown element id: ${id}`);
        if (target.parentId === id || (target.parentId && this.pathTo(target.parentId).some((ancestor) => ancestor.id === id))) {
            throw new Error('An element cannot be moved inside itself.');
        }
        const origin = this.remove(id);
        const destination = { ...target };
        if (origin.parentId === destination.parentId && origin.index < destination.index) destination.index -= 1;
        try { this.insert(node, destination); }
        catch (error) { this.insert(node, origin); throw error; }
        this.emit('document:move', { id, from: origin, to: destination });
        return { from: origin, to: destination };
    }

    update(id, patch) {
        const node = this.get(id);
        if (!node) throw new Error(`Unknown element id: ${id}`);
        if (patch.settings) node.settings = { ...node.settings, ...clone(patch.settings) };
        if (patch.styles) node.styles = mergeStyles(node.styles, patch.styles);
        this.emit('document:update', { id, patch: clone(patch) });
        return node;
    }

    updateSettings(patch) {
        this.data.settings = { ...this.data.settings, ...clone(patch) };
        this.emit('document:settings', { patch: clone(patch), settings: clone(this.data.settings) });
        return this.data.settings;
    }

    replace(data) { this.data = this.normalize(data); this.reindex(); this.emit('document:replace', this.serialize()); }
    emit(event, payload) { if (this.events) this.events.emit(event, payload); }
}
