// Turning a plain spec (`{ type, settings, styles, children }`) into live store nodes is shared by
// every producer of trees: the Copilot (`append_tree`, `compose_*`), the panel's Sections library,
// and drag & drop. One implementation means one set of acceptance rules, and a tree the AI composes
// is byte-for-byte the tree a human drops in.

export const specNodeCount = (spec) => 1 + (Array.isArray(spec?.children) ? spec.children.reduce((sum, child) => sum + specNodeCount(child), 0) : 0);

// Two tools hand a model a tree-shaped payload with different keys — compose_page/compose_section
// take { name, variant } for archetype sections, while replace_page/append_tree take native nodes
// keyed by { type }. Mixing them is the single most likely way a composed tree is rejected, so the
// missing-key message says which one this is.
const missingTypeMessage = (path, spec) => {
    const keys = Object.keys(spec);
    const named = typeof spec.name === 'string' && spec.name.trim() ? ` — "name" is for compose_page/compose_section archetype sections; a native tree node uses "type"` : '';
    return `${path} has no "type"${keys.length ? ` (it has: ${keys.join(', ')})` : ' and is empty'}${named}`;
};

const describeValue = (value) => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'an array, not a node object';
    if (typeof value !== 'object') return `${typeof value}, not a node object`;
    return null;
};

// Where a tree is wrong, and how. The path matters more than the count: a page tree is hundreds of
// nodes, and "Every tree node requires a type" leaves a composer to guess which one — which is how a
// model ends up retrying the same rejected payload until its round budget runs out.
export function specProblems(runtime, spec, path = 'root', parentType = null, out = []) {
    const shape = describeValue(spec);
    if (shape) {
        out.push(`${path} is ${shape}`);
        return out;
    }
    if (!spec.type) {
        out.push(missingTypeMessage(path, spec));
        return out;
    }

    const known = runtime.elements.has(spec.type);
    const definition = known ? runtime.elements.get(spec.type) : null;
    if (!known) out.push(`${path} uses "${spec.type}", which is not an element type`);
    else if (definition.internal) out.push(`${path} uses "${spec.type}", an editor-only organizational layer — compose visual layouts with Frames instead`);

    if (spec.children !== undefined && !Array.isArray(spec.children)) {
        out.push(`${path}.children must be an array of nodes`);
        return out;
    }
    if (Array.isArray(spec.children) && spec.children.length) {
        if (definition && !definition.acceptsChildren) out.push(`${path} ("${spec.type}") cannot contain children`);
        spec.children.forEach((child, index) => specProblems(runtime, child, `${path}.children[${index}]`, spec.type, out));
    }
    return out;
}

export function materializeSpec(runtime, spec, parent = null, path = 'root') {
    const shape = describeValue(spec);
    if (shape) throw new TypeError(`${path} is ${shape}; every tree node must be a node object.`);
    if (!spec.type) {
        throw new TypeError(`${missingTypeMessage(path, spec)}; every tree node requires a type at every level — use an exact element type from get_capabilities.`);
    }
    if (!runtime.elements.has(spec.type)) throw new TypeError(`${path} uses "${spec.type}", which is not an element type (see get_capabilities).`);
    if (runtime.elements.get(spec.type).internal) throw new TypeError(`${spec.type} is an editor-only organizational layer; compose visual layouts with Frames instead.`);
    const definition = runtime.elements.get(spec.type);
    if (spec.children?.length && !definition.acceptsChildren) throw new TypeError(`${path} ("${spec.type}") cannot contain children.`);
    const node = runtime.create(spec.type, { settings: spec.settings || {}, styles: spec.styles || {} });
    if (parent && !runtime.elements.accepts(parent, node)) throw new TypeError(`${parent.type} cannot contain ${node.type}.`);
    if (definition.acceptsChildren) node.children = (spec.children || []).map((child, index) => materializeSpec(runtime, child, node, `${path}.children[${index}]`));
    return node;
}
