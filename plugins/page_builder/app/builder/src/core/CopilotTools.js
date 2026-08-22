// Client-side design tools for the AI Copilot. The design lives in the browser as the v2
// builder store, so the Copilot interacts with it DIRECTLY — each tool call runs against the
// live runtime (history-aware: every edit is undoable) and the canvas morphs in place, exactly
// as if a human dragged/typed. This replaces the old server-side v1 spec mutation.
//
// Addressable nodes: the index() output numbers every node with a dot path (e.g. "0.1.2" =
// root child 0 → child 1 → child 2). Tools accept either a path or an element id.

const labelOf = (node) => {
    const text = node.settings?.text || node.settings?.title || node.settings?.label || '';
    return text ? ` — ${String(text).slice(0, 60)}` : '';
};

export function createCopilotTools(runtime, builder) {
    const resolve = (pathOrId) => {
        if (!pathOrId) return null;
        if (typeof pathOrId === 'string' && pathOrId.includes('.')) {
            const parts = pathOrId.split('.').map(Number);
            let node = null, parent = null;
            for (const part of parts) {
                const siblings = node ? (node.children || []) : runtime.document.data.children;
                const next = siblings[part];
                if (!next) return null;
                parent = node;
                node = next;
            }
            return { node, parent, path: pathOrId };
        }
        const node = runtime.document.get(pathOrId);
        return node ? { node, parent: runtime.document.parentOf(node.id), path: pathOrId } : null;
    };

    const indexNode = (node, path) => {
        const definition = runtime.elements.get(node.type);
        const lines = [`[${path}] ${definition.title}${labelOf(node)} (id ${node.id.slice(0, 8)})`];
        (node.children || []).forEach((child, i) => {
            lines.push(...indexNode(child, `${path}.${i}`).map((line) => `    ${line}`));
        });
        return lines;
    };

    const index = () => {
        if (!runtime.document.data.children.length) return '(empty page)';
        return runtime.document.data.children.map((node, i) => indexNode(node, String(i))).flat().join('\n');
    };

    const readStyles = (target) => {
        if (!target) return 'element not found';
        return JSON.stringify({ settings: target.node.settings, styles: target.node.styles }, null, 1);
    };

    const cssEdit = (selector, property, value) => {
        let css = builder.customCode.getCss();
        const blockRe = new RegExp(`(${escapeRegExp(selector)}\\s*\\{)([^}]*)(\\})`, 'm');
        const match = blockRe.exec(css);
        if (match) {
            const declRe = new RegExp(`(${escapeRegExp(property)}\\s*:\\s*)[^;\\n]+`, 'i');
            const inside = declRe.test(match[2]) ? match[2].replace(declRe, `$1${value}`) : `${match[2].trimEnd()}\n  ${property}: ${value};`;
            css = css.replace(blockRe, `${match[1]}${inside}${match[3]}`);
        } else {
            css = `${css.trimEnd()}\n${selector} {\n  ${property}: ${value};\n}`.trim();
        }
        builder.customCode.update(css, builder.customCode.getJs());
        return 'ok';
    };

    const apply = (name, args = {}) => {
        const target = resolve(args.path || args.id);
        switch (name) {
            case 'read_design': return index();
            case 'read_element': return target ? readStyles(target) : 'element not found';
            case 'insert_element': {
                const type = args.type;
                if (!runtime.elements.has(type)) return `unknown element type: ${type} (use one of ${runtime.elements.list().map((d) => d.type).join(', ')})`;
                if (target && !runtime.elements.get(target.node.type).acceptsChildren) return 'target cannot contain children';
                const node = runtime.create(type, { settings: args.settings, styles: args.styles });
                runtime.document.insert(node, { parentId: target ? target.node.id : null, index: target ? (target.node.children?.length || 0) : runtime.document.data.children.length });
                runtime.events.emit('element:select', { id: node.id });
                return `ok — added ${type} at ${target ? target.path : 'root'}`;
            }
            case 'update_element': {
                if (!target) return 'element not found';
                runtime.update(target.node.id, { settings: args.settings || {} }, 'AI edit element');
                return 'ok';
            }
            case 'set_styles': {
                if (!target) return 'element not found';
                runtime.update(target.node.id, { styles: args.styles || {} }, 'AI set styles');
                return 'ok';
            }
            case 'move_element': {
                if (!target) return 'element not found';
                const dest = resolve(args.targetPath || args.targetId);
                if (!dest) return 'target not found';
                const parentId = args.position === 'inside' ? dest.node.id : dest.parent?.id || null;
                const siblings = parentId ? runtime.document.get(parentId)?.children || [] : runtime.document.data.children;
                const index = args.position === 'inside' ? siblings.length : siblings.findIndex((n) => n.id === dest.node.id) + (args.position === 'after' ? 1 : 0);
                runtime.move(target.node.id, { parentId, index: Math.max(0, index) });
                return 'ok';
            }
            case 'remove_element': {
                if (!target) return 'element not found';
                runtime.remove(target.node.id);
                return 'ok';
            }
            case 'duplicate_element': {
                if (!target) return 'element not found';
                runtime.duplicate(target.node.id);
                return 'ok';
            }
            case 'set_custom_css': builder.customCode.update(String(args.css || ''), builder.customCode.getJs()); return 'ok';
            case 'set_custom_js': builder.customCode.update(builder.customCode.getCss(), String(args.js || '')); return 'ok';
            case 'css_edit': {
                if (!args.selector || !args.property || !args.value) return 'selector, property and value are required';
                return cssEdit(String(args.selector), String(args.property), String(args.value));
            }
            case 'undo': runtime.history.undo(); return 'ok';
            case 'redo': runtime.history.redo(); return 'ok';
            default: return `unknown tool: ${name}`;
        }
    };

    // OpenAI function schemas the model can call.
    const TOOLS = [
        { name: 'read_design', description: 'Return the current page design as a numbered tree (e.g. [0.1.2]). Use this before editing to target elements precisely.', parameters: { type: 'object', properties: {} } },
        { name: 'read_element', description: 'Return one element\'s settings and styles. Address it with path (e.g. "0.1") or id.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Dot path from read_design' } } } },
        { name: 'insert_element', description: 'Add a builder element inside a container/section (path) or at the page root (omit path). type is a builder element type (container, heading, paragraph, button, image, icon, divider, spacer, icon-list, counter, progress, rating, testimonial, tabs, accordion, toggle, alert, video, map, gallery, carousel, social-icons, text-editor, ...).', parameters: { type: 'object', properties: { path: { type: 'string' }, type: { type: 'string' }, settings: { type: 'object' }, styles: { type: 'object' } }, required: ['type'] } },
        { name: 'update_element', description: 'Change an element\'s settings (text, tag, link, icon, etc.).', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' }, settings: { type: 'object' } }, required: ['settings'] } },
        { name: 'set_styles', description: 'Set an element\'s styles. Shape: { desktop: { base: { <property>: <value> } }, tablet: {...}, mobile: {...} } or the legacy flat { base: {...} }. Use CSS property names (color, font-size as {size,unit}, margin as {top,right,bottom,left,unit}, filter as {blur,brightness,...}, background-color, etc.).', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' }, styles: { type: 'object' } }, required: ['styles'] } },
        { name: 'move_element', description: 'Move an element before/after another element, or inside a container. position: before|after|inside.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' }, targetPath: { type: 'string' }, targetId: { type: 'string' }, position: { type: 'string', enum: ['before', 'after', 'inside'] } }, required: ['position'] } },
        { name: 'remove_element', description: 'Remove an element (and its children).', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' } } } },
        { name: 'duplicate_element', description: 'Duplicate an element as a sibling.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' } } } },
        { name: 'set_custom_css', description: 'Replace the page-level custom CSS (design tokens like :root { --ink-color-primary: #...; }).', parameters: { type: 'object', properties: { css: { type: 'string' } }, required: ['css'] } },
        { name: 'css_edit', description: 'Set ONE property on a selector in the page custom CSS (adds the rule if the selector is missing).', parameters: { type: 'object', properties: { selector: { type: 'string' }, property: { type: 'string' }, value: { type: 'string' } }, required: ['selector', 'property', 'value'] } },
        { name: 'undo', description: 'Undo the last change.', parameters: { type: 'object', properties: {} } },
    ];

    return { apply, index, resolve, TOOLS };
}

const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
