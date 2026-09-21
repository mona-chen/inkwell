const clone = (value) => value == null ? value : structuredClone(value);
import { mergeStyles, emptyStyles } from './StyleValueModel.js';

// Component states and interactions are a universal element contract, not a per-type feature:
// any layer can be a state provider ("monthly / yearly") and any layer can trigger a change.
// Registering them once here keeps every element type — including imported DOM — equally capable
// without repeating two control descriptors a hundred times.
const INTERACTION_CONTROLS = [
    { tab: 'advanced', target: 'settings', section: 'Interaction', name: 'stateNames', type: 'state-names', label: 'Component states' },
    { tab: 'advanced', target: 'settings', section: 'Interaction', name: 'interactions', type: 'interactions', label: 'Interactions' },
];

// Class and ID are element attributes, not a per-type feature: any layer can carry them, so custom
// CSS, anchor links, and interactions can target a container exactly as they target a heading. The
// renderer already applies both to every node; this is the missing way to author them.
const IDENTITY_CONTROLS = [
    { tab: 'advanced', target: 'settings', section: 'Custom attributes', name: 'cssId', type: 'text', label: 'CSS ID' },
    { tab: 'advanced', target: 'settings', section: 'Custom attributes', name: 'cssClasses', type: 'text', label: 'CSS classes', description: 'Space-separated classes. Custom CSS and interactions can target them.' },
];

export default class ElementRegistry {    constructor() { this.definitions = new Map(); }

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
        const controls = [...(definition.controls || [])];
        if (definition.interactive !== false && !definition.internal) controls.push(...INTERACTION_CONTROLS);
        if (!definition.internal) {
            const declaredNames = new Set(controls.map((control) => control.name));
            IDENTITY_CONTROLS.forEach((control) => { if (!declaredNames.has(control.name)) controls.push(control); });
        }
        this.definitions.set(definition.type, Object.freeze({
            title: definition.type,
            icon: 'widgets',
            category: 'Basic',
            keywords: [],
            controls: [],
            acceptsChildren: false,
            ...definition,
            controls,
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
            styles: mergeStyles(emptyStyles(), { ...(defaults.styles || {}), ...(overrides.styles || {}) }),
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
