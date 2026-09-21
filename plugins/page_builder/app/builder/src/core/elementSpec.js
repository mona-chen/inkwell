// Turning a plain spec (`{ type, settings, styles, children }`) into live store nodes is shared by
// every producer of trees: the Copilot (`append_tree`, `compose_*`), the panel's Sections library,
// and drag & drop. One implementation means one set of acceptance rules, and a tree the AI composes
// is byte-for-byte the tree a human drops in.

export const specNodeCount = (spec) => 1 + (Array.isArray(spec?.children) ? spec.children.reduce((sum, child) => sum + specNodeCount(child), 0) : 0);

export function materializeSpec(runtime, spec, parent = null) {
    if (!spec || typeof spec !== 'object' || !spec.type) throw new TypeError('Every tree node requires a type.');
    if (!runtime.elements.has(spec.type)) throw new TypeError(`Unknown element type: ${spec.type}`);
    if (runtime.elements.get(spec.type).internal) throw new TypeError(`${spec.type} is an editor-only organizational layer; compose visual layouts with Frames instead.`);
    const definition = runtime.elements.get(spec.type);
    if (spec.children?.length && !definition.acceptsChildren) throw new TypeError(`${spec.type} cannot contain children.`);
    const node = runtime.create(spec.type, { settings: spec.settings || {}, styles: spec.styles || {} });
    if (parent && !runtime.elements.accepts(parent, node)) throw new TypeError(`${parent.type} cannot contain ${node.type}.`);
    if (definition.acceptsChildren) node.children = (spec.children || []).map((child) => materializeSpec(runtime, child, node));
    return node;
}
