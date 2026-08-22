export default class ControlRegistry {
    constructor() { this.controls = new Map(); }
    register(type, renderer) {
        if (this.controls.has(type)) throw new Error(`Control type already registered: ${type}`);
        if (typeof renderer !== 'function') throw new TypeError('Control renderer must be a function.');
        this.controls.set(type, renderer);
        return this;
    }
    get(type) {
        const renderer = this.controls.get(type);
        if (!renderer) throw new Error(`Unknown control type: ${type}`);
        return renderer;
    }
    render(schema, context) { return this.get(schema.type)(schema, context); }
}
