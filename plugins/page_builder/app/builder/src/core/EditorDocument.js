const clone = (value) => structuredClone(value);
import { normalizeStyles, mergeStyles } from './StyleValueModel.js';

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
        // Migrate any legacy-flat style buckets into the device × state model.
        const visit = (node) => {
            if (node && node.styles && typeof node.styles === 'object') node.styles = normalizeStyles(node.styles);
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
