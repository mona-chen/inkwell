const clone = (value) => value == null ? value : structuredClone(value);

export default class ElementRegistry {
    constructor() { this.definitions = new Map(); }

    register(definition) {
        if (!definition || typeof definition.type !== 'string' || !definition.type.trim()) {
            throw new TypeError('Element definition requires a non-empty type.');
        }
        if (this.definitions.has(definition.type)) {
            throw new Error(`Element type already registered: ${definition.type}`);
        }
        // Every style control that targets a named part must resolve to a declared selector.
        const selectors = definition.selectors || {};
        for (const control of definition.controls || []) {
            if (control.part && control.part !== 'root' && !selectors[control.part]) {
                throw new TypeError(`Element "${definition.type}" control "${control.name}" targets unknown part "${control.part}" — declare it in selectors.`);
            }
        }
        this.definitions.set(definition.type, Object.freeze({
            title: definition.type,
            icon: 'widgets',
            category: 'Basic',
            keywords: [],
            controls: [],
            acceptsChildren: false,
            ...definition,
        }));
        return this;
    }

    unregister(type) { this.definitions.delete(type); }
    has(type) { return this.definitions.has(type); }
    get(type) {
        const definition = this.definitions.get(type);
        if (!definition) throw new Error(`Unknown element type: ${type}`);
        return definition;
    }
    list() { return [...this.definitions.values()]; }

    create(type, overrides = {}) {
        const definition = this.get(type);
        const defaults = typeof definition.defaults === 'function' ? definition.defaults() : (definition.defaults || {});
        return {
            id: overrides.id || crypto.randomUUID(),
            type,
            settings: { ...(clone(defaults.settings) || {}), ...(clone(overrides.settings) || {}) },
            styles: {
                base: {}, tablet: {}, mobile: {}, hover: {}, focus: {},
                ...(clone(defaults.styles) || {}),
                ...(clone(overrides.styles) || {}),
            },
            ...(definition.acceptsChildren ? { children: clone(overrides.children || defaults.children || []) } : {}),
        };
    }

    accepts(parent, child) {
        const parentDefinition = this.get(parent.type);
        const childDefinition = this.get(child.type);
        if (!parentDefinition.acceptsChildren) return false;
        if (typeof parentDefinition.acceptsChild === 'function' && !parentDefinition.acceptsChild(parent, child, childDefinition)) return false;
        if (typeof childDefinition.canBeChildOf === 'function' && !childDefinition.canBeChildOf(child, parent, parentDefinition)) return false;
        return true;
    }
}
