import { normalizeShader, validateCustomShader, SHADER_PRESETS, CUSTOM_SHADER_EXAMPLE } from './shaderPresets.js';
import {
    INTERACTION_ACTIONS, INTERACTION_EVENTS, INTERACTION_TARGETS,
    normalizeInteractions, normalizeStateList, normalizeStateName,
} from './states.js';
import { MOTION_GROUP_KINDS, MOTION_GROUP_TRIGGERS, describeMotionGroup, motionGroupItems, normalizeMotionGroup } from './motionGroups.js';
import {
    DEFAULT_TOKENS, applyDesignTokens, describeTokens, ensureDesignCss, normalizeTokens, presetNames, presetTokens, tokenVariables, tokensFromPageSettings,
} from './designTokens.js';
import { archetype, buildSection, composePage, listArchetypes } from './sectionArchetypes.js';
import { materializeSpec, specNodeCount } from './elementSpec.js';
import { auditStore } from './designAudit.js';
import { isUnsupportedValue, previewValue, shapeOf } from './styleValues.js';
import { iconCount, libraryTitle, searchIcons } from './icons.js';
import { availableMediaTools, generateImage, imageProviders, imageSearchUrl, listMedia, mediaLibraryUrl, searchImages } from './mediaTools.js';
// Client-side design tools for the AI Copilot. The design lives in the browser as the v2
// builder store, so every mutation is applied to the live runtime and recorded as one or more
// undoable commands. Whole pages are composed atomically; surgical follow-up edits still use
// stable ids or the dot paths returned by read_design.

const MAX_TREE_NODES = 240;
const MAX_CUSTOM_CODE_LENGTH = 120_000;

const clone = (value) => value == null ? value : structuredClone(value);
const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const textValue = (node) => node.settings?.text || node.settings?.title || node.settings?.label || '';
const labelOf = (node) => textValue(node) ? ` — ${String(textValue(node)).replace(/<[^>]+>/g, '').slice(0, 60)}` : '';
const asJson = (value) => JSON.stringify(value);

export function createCopilotTools(runtime, builder) {
    const isNumericPath = (value) => /^\d+(\.\d+)*$/.test(String(value));
    const resolve = (pathOrId) => {
        if (!pathOrId) return null;
        if (isNumericPath(pathOrId)) {
            const parts = String(pathOrId).split('.').map(Number);
            let node = null, parent = null;
            for (const part of parts) {
                const siblings = node ? (node.children || []) : runtime.document.data.children;
                const next = siblings[part];
                if (!next) return null;
                parent = node;
                node = next;
            }
            return { node, parent, path: String(pathOrId) };
        }
        const node = runtime.document.get(String(pathOrId));
        return node ? { node, parent: runtime.document.parentOf(node.id), path: String(pathOrId) } : null;
    };

    // Behaviour is part of the design, so read_design reports it: a layer's motion, its group
    // membership, sticky pinning, states and interactions are all visible without running anything.
    const annotate = (node) => {
        const tags = [];
        if (node.settings?.motion) tags.push(`motion:${node.settings.motion.trigger || 'load'}`);
        const group = normalizeMotionGroup(node.settings?.motionGroup);
        if (group) tags.push(`group:${group.kind}/${group.trigger}${group.stagger ? `+${group.stagger}ms` : ''}`);
        if (node.settings?.sticky) tags.push('sticky');
        const interactions = node.settings?.interactions;
        if (Array.isArray(interactions) && interactions.length) tags.push(`interactions:${interactions.length}`);
        const states = normalizeStateList(node.settings?.stateNames);
        if (states.length) tags.push(`states:${states.join('|')}`);
        return tags.length ? ` {${tags.join(', ')}}` : '';
    };
    const indexNode = (node, path) => {
        const definition = runtime.elements.get(node.type);
        const lines = [`[${path}] ${definition.title}${labelOf(node)} (type ${node.type}, id ${node.id})${annotate(node)}`];
        (node.children || []).forEach((child, index) => lines.push(...indexNode(child, `${path}.${index}`).map((line) => `  ${line}`)));
        return lines;
    };

    const index = () => runtime.document.data.children.length
        ? runtime.document.data.children.flatMap((node, i) => indexNode(node, String(i))).join('\n')
        : '(empty page)';

    const sharedStyleControls = new Set([
        'typography', 'color', 'background', 'background-overlay', 'background-color', 'border',
        'border-radius', 'box-shadow', 'text-shadow', 'margin', 'padding', 'width', 'max-width',
        'min-width', 'height', 'min-height', 'max-height', 'overflow', 'position', 'top', 'right',
        'bottom', 'left', 'z-index', 'align-self', 'order', 'flex-grow', 'depth-color', 'depth-size',
        'outer-radius',
        'flex-shrink', 'opacity', 'filter', 'text-align', 'font-size', 'icon-size', 'icon-gap',
    ]);
    const compactDefinition = (definition) => {
        const defaults = runtime.create(definition.type).settings;
        const contentSettings = [...new Set((definition.controls || [])
            .filter((control) => control.name && !sharedStyleControls.has(control.name))
            .map((control) => control.name))];
        return {
            type: definition.type,
            ...(definition.acceptsChildren ? { acceptsChildren: true } : {}),
            ...(Object.keys(defaults).length ? { defaults } : {}),
            ...(contentSettings.length ? { contentSettings } : {}),
        };
    };

    const capabilities = () => {
        const groups = {};
        runtime.elements.list().filter((definition) => !definition.internal).forEach((definition) => {
            const category = definition.category || 'Other';
            const compact = compactDefinition(definition);
            if (!['frame', 'container', 'heading', 'paragraph', 'button', 'image', 'shader'].includes(definition.type)) delete compact.defaults;
            (groups[category] ||= []).push(compact);
        });
        return {
            documentVersion: 2,
            componentStates: {
                setting: 'stateNames', instanceState: 'state', styleState: 'state:<name>',
                example: { settings: { stateNames: ['monthly', 'yearly'], state: 'monthly' }, styles: { desktop: { base: { opacity: 1 }, 'state:yearly': { opacity: 1 } } } },
                guidance: 'Any layer can be a state provider: name its variants in settings.stateNames and pick the authored one in settings.state. Style a variant with the reserved style bucket `state:<name>` (desktop/tablet/mobile × state:<name>), which compiles to [data-ink-state="<name>"] on that layer and its parts.',
            },
            interactions: {
                setting: 'interactions', events: INTERACTION_EVENTS, actions: INTERACTION_ACTIONS, targets: INTERACTION_TARGETS,
                example: { on: 'click', action: 'toggleState', target: 'self', state: 'open', exclusive: true },
                guidance: 'Interactions are declarative element data set with set_interactions; they run in Preview and on the published page and are undoable. For a two-state pricing switch: give the container stateNames ["monthly","yearly"], then give each option button setState interactions targeting the container (target query + selector) plus show/hide interactions for the panels that should swap.',
            },
            motion: { setting: 'motion', triggers: ['load', 'hover', 'enter', 'scroll'], example: { enabled: true, trigger: 'scroll', easing: 'linear', keyframes: [{ offset: 0, transform: 'translateX(0px)' }, { offset: 1, transform: 'translateX(-240px)' }] }, guidance: 'Set motion on a native layer with update_element. enter and scroll use the parent section as their viewport reference, respect reduced motion, and run in Preview/published pages. Motion stays editable in the Motion panel.' },
            motionGroup: { setting: 'motionGroup', kinds: MOTION_GROUP_KINDS, triggers: MOTION_GROUP_TRIGGERS, example: { kind: 'stagger', trigger: 'enter', stagger: 120, duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' }, pinnedExample: { kind: 'scrub', trigger: 'scroll', stagger: 0, pin: { enabled: true, distance: 120 }, scrub: { reference: 'group' } }, guidance: 'A motion group orchestrates the children of one layer into a single timeline with set_motion_group: the children keep their own keyframes, the group shares a trigger (hover the group, scroll progress, enter, load) and adds a per-child stagger. For a hover unfold set trigger hover; for a scroll-scrubbed or pinned section set trigger scroll, pin.enabled true, and put the animated stage inside it with set_sticky.' },
            designSystem: {
                setting: 'theme',
                tokenGroups: Object.keys(DEFAULT_TOKENS),
                tokenNames: Object.keys(tokenVariables(DEFAULT_TOKENS)),
                presets: presetNames(),
                archetypes: listArchetypes(),
                current: describeTokens(liveTokens()),
                guidance: 'The design system is tokens plus named section archetypes. Set the palette once with set_design_tokens (or pass preset), then compose with compose_page/compose_section using archetype names and variants. Archetypes emit real editable elements styled only from tokens, so a human can reproduce any composition from the Elements library and the Theme controls.',
            },
            elements: groups,
            icons: {
                libraries: ['material', 'lucide', 'phosphor'].map((library) => ({ library, title: libraryTitle(library), count: iconCount(library) })),
                valueShape: 'A bare name is a Material Symbols ligature and must be a real snake_case Material name ("arrow_forward"). Prefix another library as "lucide:eye-off" or "phosphor:eye-slash" to store that vendored icon.',
                guidance: 'Call search_icons before setting an icon rather than guessing a name. Lucide and Phosphor are vendored inline SVGs, so they render the same in the canvas and on published output and need no font; Material Symbols are font ligatures in the canvas. Never invent a name: an unresolved name renders as its literal text.',
            },
            styleShape: { desktop: { base: { color: '#111827', padding: { top: 24, right: 24, bottom: 24, left: 24, unit: 'px' } } }, tablet: { base: {} }, mobile: { base: {} } },
            styleContract: {
                shape: 'styles is { desktop|tablet|mobile: { base|hover|focus|active|"state:<name>": { controlName: value } } }. A flat { base: {...} } is accepted and normalized.',
                valueShapes: {
                    size: '{ size: 7, unit: "px" } — width, height, min/max width and height, font-size, border-radius, border-width, icon-size',
                    box: '{ top, right, bottom, left, unit } — padding, margin, inset',
                    gap: '{ row, column, unit } — gap, row-gap, column-gap',
                    border: '{ width, style, color } — border, border-top and friends',
                    shadow: '{ x, y, blur, spread, color } — box-shadow, text-shadow',
                    filter: '{ blur, brightness, contrast, saturate, hue } — filter',
                    color: '"#RRGGBB" (or any CSS color string)',
                    keyword: '"fit-content" | "auto" | "100%" | "100vh" — plain CSS strings are passed through',
                },
                rules: [
                    'Sizes are always { size, unit }. { value, unit } is accepted and normalized to it, but the inspector writes { size, unit } — prefer that spelling.',
                    'Use the control name the element actually declares. Frames, containers, text and inputs carry `background`; a Button carries `background-color` (its surface) — call get_element_schema when unsure.',
                    'A record the compiler does not recognize is dropped from the stylesheet rather than published, and audit_design reports it. Never invent a record shape; use a plain CSS string instead.',
                    'Element styles are authoritative over custom CSS: write layout, type, colour and spacing as node styles and keep custom CSS for what nodes cannot express.',
                    'A Frame or Container declares no size of its own, so it fills its parent -- a card fills its grid column. Set width/height only to change that: { size, unit } for a fixed size, "fit-content" to hug its content (a pill, chip, badge, button), "100%" to fill explicitly.',
                ],
            },
            media: {
                listTool: 'list_media',
                listUrl: mediaLibraryUrl(),
                searchTool: canSearchImages() ? 'search_images' : null,
                searchKinds: canSearchImages() ? imageProviders() : [],
                generateTool: canGenerateImages() ? 'generate_image' : null,
                guidance: mediaGuidance(),
            },
            customCode: { css: true, javascript: true, designKitClasses: true, maximumCharactersEach: MAX_CUSTOM_CODE_LENGTH },
            shaderFills: { presets: SHADER_PRESETS.map(([id]) => id), setting: 'shaderFill', example: { enabled: true, preset: 'mesh-gradient', speed: .5, intensity: .7 }, customShader: CUSTOM_SHADER_EXAMPLE, guidance: 'Apply shader fills to existing layers with set_shader_fill. Custom GLSL compiles before applying and stays editable in Fill.' },
            composition: {
                maximumNodes: MAX_TREE_NODES,
                recursiveChildren: true,
                atomicUndo: true,
                nativeFrames: ['frame', 'container'],
                sizing: ['fixed', 'relative', 'fit-content', 'fill-container'],
                constraints: ['top', 'right', 'bottom', 'left', 'min-width', 'max-width', 'min-height', 'max-height'],
                guidance: 'Compose layered visuals as recursive native Frame trees. Frames own visual surfaces and layout modes (Freeform, Stack, Grid); Groups are editor-only organizational layers created from a user selection. Use parent-relative constraints for floating layers and Button surface/depth controls for dimensional CTAs; custom CSS is an escape hatch, not the primary layout model.',
            },
        };
    };

    // Trees are materialized by the shared element-spec helper, so the Copilot, the Sections library
    // and drag & drop all accept exactly the same shapes.
    // Image generation is a configured capability, not a promise: it is advertised (and
    // offered to the model) only while the site names an image model.
    const canGenerateImages = () => availableMediaTools().some((tool) => tool.name === 'generate_image');
    const canSearchImages = () => availableMediaTools().some((tool) => tool.name === 'search_images');

    // The picture rules are assembled from what this site can actually do, so the model is never
    // told to reach for a source the server cannot serve.
    const mediaGuidance = () => {
        const parts = [
            'Pictures are real files in the site media library. Call list_media first and place a returned url in an Image element settings.src with its alt text; the owner\'s own pictures win.',
            'Always set alt. Never hotlink an outside image and never invent a url.',
        ];
        if (canSearchImages()) {
            const kinds = [ ...new Set(imageProviders().map((entry) => entry.kind)) ].join(', ');
            parts.push(`When the library has nothing suitable, search_images reaches libraries outside the site (${kinds}) and files what it finds into that same library, so the returned url is an ordinary media file; carry any credit the result names.`);
        }
        if (canGenerateImages()) {
            parts.push('generate_image then creates a picture that does not exist anywhere and files it the same way.');
        }
        if (!canSearchImages() && !canGenerateImages()) {
            parts.push('This site can neither search nor generate pictures: when the library has nothing suitable, leave the media empty and let type and layout carry the design.');
        }
        return parts.join(' ');
    };

    const countSpec = specNodeCount;
    const materialize = (spec, parent = null) => materializeSpec(runtime, spec, parent);

    // The write half of the style contract. Storage is always repaired to the canonical shape, and
    // a value the compiler will have to drop is reported back in the tool result so the next call
    // can correct it. A silently dropped value is how a page ends up styled in the tree and
    // unstyled on screen.
    const styleWarnings = (styles) => {
        const warnings = [];
        const inspect = (settings, where) => {
            Object.entries(settings || {}).forEach(([key, value]) => {
                if (!value || typeof value !== 'object' || Array.isArray(value)) return;
                const shape = shapeOf(value);
                if (isUnsupportedValue(value)) warnings.push(`styles.${where}.${key} = ${previewValue(value)} is not a value the builder can compile; use a CSS string or a documented record.`);
                else if (shape === 'size' && !Object.hasOwn(value, 'size')) warnings.push(`styles.${where}.${key}: normalized { value, unit } to the canonical { size, unit }.`);
            });
        };
        Object.entries(styles || {}).forEach(([bucket, value]) => {
            if (!value || typeof value !== 'object') return;
            const nested = Object.keys(value).some((key) => ['base', 'hover', 'focus', 'active'].includes(key) || key.startsWith('state:'));
            if (nested) Object.entries(value).forEach(([state, settings]) => inspect(settings, `${bucket}.${state}`));
            else inspect(value, bucket);
        });
        return warnings;
    };

    const treeStyleWarnings = (tree, path = 'root', out = []) => {
        if (!tree || typeof tree !== 'object' || out.length >= 12) return out;
        styleWarnings(tree.styles).forEach((warning) => out.push(`${path}: ${warning}`));
        (tree.children || []).forEach((child, index) => treeStyleWarnings(child, `${path}.${index}`, out));
        return out.slice(0, 12);
    };

    const withWarnings = (result, warnings) => warnings.length ? { ...result, warnings } : result;

    // Tools that answered a plain `ok` keep answering exactly that on a clean write, so an existing
    // caller never has to learn a new result shape. A warning upgrades the answer to JSON, because a
    // dropped value is the one case the next call has to act on.
    const okUnlessWarned = (warnings) => warnings.length ? asJson({ ok: true, warnings }) : 'ok';

    const validateCustomCode = (value, label) => {
        const text = String(value || '');
        if (text.length > MAX_CUSTOM_CODE_LENGTH) throw new RangeError(`${label} exceeds ${MAX_CUSTOM_CODE_LENGTH} characters.`);
        return text;
    };

    const updateCustomCode = (css, js, label = 'AI update custom code') => {
        const before = { css: builder.customCode.getCss(), js: builder.customCode.getJs() };
        const after = { css: validateCustomCode(css, 'CSS'), js: validateCustomCode(js, 'JavaScript') };
        runtime.history.execute({
            label,
            do: () => builder.customCode.update(after.css, after.js),
            undo: () => builder.customCode.update(before.css, before.js),
        });
    };

    const replacePage = (args) => {
        if (!Array.isArray(args.children) || !args.children.length) throw new TypeError('replace_page requires a non-empty children array; the existing page was preserved. Send the complete tree in one call, or build the page section by section with append_tree when it is too large for one payload.');
        const specs = args.children;
        const nodeCount = specs.reduce((sum, spec) => sum + countSpec(spec), 0);
        if (nodeCount > MAX_TREE_NODES) throw new RangeError(`Page has ${nodeCount} nodes; maximum is ${MAX_TREE_NODES}.`);
        const children = specs.map((spec) => materialize(spec));
        const before = { store: runtime.serialize(), css: builder.customCode.getCss(), js: builder.customCode.getJs() };
        const after = {
            store: {
                version: 2,
                type: 'page',
                settings: { ...clone(before.store.settings), ...(clone(args.settings) || {}) },
                children,
            },
            css: args.customCss == null ? before.css : validateCustomCode(args.customCss, 'CSS'),
            js: args.customJs == null ? before.js : validateCustomCode(args.customJs, 'JavaScript'),
        };
        runtime.history.execute({
            label: 'AI compose page',
            do: () => { runtime.document.replace(after.store); builder.customCode.update(after.css, after.js); runtime.selection.clear(); },
            undo: () => { runtime.document.replace(before.store); builder.customCode.update(before.css, before.js); runtime.selection.clear(); },
        });
        return withWarnings({ ok: true, nodes: nodeCount, roots: children.length, message: 'Page composed as one undoable change.' }, children.flatMap((child, index) => treeStyleWarnings(child, `children.${index}`)).slice(0, 12));
    };

    const appendTree = (args) => {
        const total = countSpec(args.tree);
        if (total > MAX_TREE_NODES) throw new RangeError(`Tree has ${total} nodes; maximum is ${MAX_TREE_NODES}.`);
        const target = resolve(args.path || args.id);
        if ((args.path || args.id) && !target) throw new TypeError('Target not found; read_design for current IDs. No elements were inserted.');
        const parent = target?.node || null;
        if (parent && !runtime.elements.get(parent.type).acceptsChildren) throw new TypeError('Target cannot contain children.');
        const node = materialize(args.tree, parent);
        const insertion = { parentId: parent?.id || null, index: parent ? (parent.children?.length || 0) : runtime.document.data.children.length };
        runtime.history.execute({ label: 'AI add layout', do: () => runtime.document.insert(node, insertion), undo: () => runtime.document.remove(node.id) });
        runtime.selection.select(node.id);
        return withWarnings({ ok: true, nodes: total, id: node.id }, treeStyleWarnings(args.tree));
    };

    // Composing a page is choosing archetypes and filling them in. There is no bespoke aesthetic
    // here any more: the same named, token-driven sections a human picks in the panel are what the
    // model composes, so its ceiling is the builder's ceiling, not one hardcoded layout.
    const liveTokens = () => tokensFromPageSettings(runtime.document.data.settings);

    const tokensFromArgs = (args) => normalizeTokens({
        ...(args.preset ? presetTokens(args.preset) || {} : {}),
        ...(args.tokens || {}),
        colors: {
            ...(args.tokens?.colors || {}),
            ...Object.fromEntries(Object.entries(args.palette || {}).filter(([, value]) => value != null)),
        },
    });

    // Legacy composer arguments (hero/projects/proof/process/faq/footer) map onto archetype content so
    // existing prompts keep working; anything in `content` overrides the mapping.
    const mergeContent = (args) => {
        const hero = args.hero || {};
        const legacy = {
            ...(hero.eyebrow != null ? { eyebrow: hero.eyebrow } : {}),
            ...(hero.headline != null ? { title: hero.headline } : {}),
            ...(hero.body != null ? { lede: hero.body } : {}),
            ...(hero.primaryCta != null ? { cta: hero.primaryCta } : {}),
            ...(hero.secondaryCta != null ? { secondary: hero.secondaryCta } : {}),
            ...(Array.isArray(args.projects) && args.projects.length ? { features: args.projects.map((project) => ({ title: project.title, body: project.summary })) } : {}),
            ...(args.workHeading != null ? { featureTitle: args.workHeading } : {}),
            ...(args.workBody != null ? { featureLede: args.workBody } : {}),
            ...(args.proof?.heading != null ? { testimonialTitle: args.proof.heading } : {}),
            ...(Array.isArray(args.proof?.stats) ? { stats: args.proof.stats } : {}),
            ...(args.faq?.heading != null ? { faqTitle: args.faq.heading } : {}),
            ...(Array.isArray(args.faq?.items) ? { faq: args.faq.items.map((item) => ({ question: item.question || item.title, answer: item.answer || item.body })) } : {}),
            ...(args.footer?.copyright != null ? { legal: args.footer.copyright } : {}),
            ...(Array.isArray(args.footer?.links) ? { links: [{ title: 'Elsewhere', items: args.footer.links.map((label) => ({ text: String(label), url: '#' })) }] } : {}),
        };
        const merged = { ...legacy, ...(args.content || {}) };
        if (args.siteName) merged.nav = { ...(merged.nav || {}), brand: args.siteName };
        return merged;
    };

    // The design system (token variables, archetype vocabulary, section rhythm, component states)
    // lives in the page's custom CSS. Install it on demand so a section composed into a hand-built
    // page still renders, and never duplicate it.
    const ensureArchetypeCss = (tokens) => ensureDesignCss(builder.customCode.getCss(), tokens);

    const composeLandingPage = (args) => {
        const tokens = tokensFromArgs(args);
        const composed = composePage(args.sections, { tokens, content: mergeContent(args), media: args.media });
        return replacePage({
            settings: { backgroundColor: tokens.colors.background },
            children: composed.children,
            customCss: composed.css,
            customJs: '',
        });
    };

    const composeArchetypePage = (args) => {
        const tokens = tokensFromArgs(args);
        const composed = composePage(args.sections, { tokens, content: args.content || {}, media: args.media });
        const result = replacePage({
            settings: { backgroundColor: tokens.colors.background },
            children: composed.children,
            customCss: composed.css,
            customJs: args.customJs == null ? builder.customCode.getJs() : args.customJs,
        });
        return { ...result, sections: composed.children.map((child) => child.settings.role || child.type), tokens: describeTokens(tokens) };
    };

    const composeSection = (args) => {
        const name = args.archetype || args.name;
        if (!archetype(name)) throw new TypeError(`Unknown archetype "${name}". Call list_archetypes first.`);
        const tokens = args.tokens ? normalizeTokens(args.tokens) : liveTokens();
        const built = buildSection(name, { variant: args.variant, content: args.content || {}, tokens, media: args.media, uid: `ink-arch-${Date.now().toString(36)}`, sticky: args.sticky });
        const target = resolve(args.path || args.id);
        if ((args.path || args.id) && !target) throw new TypeError('Target not found; read_design for current IDs. No elements were inserted.');
        const parent = target?.node || null;
        if (parent && !runtime.elements.get(parent.type).acceptsChildren) throw new TypeError('Target cannot contain children.');
        const node = materialize(built.spec, parent);
        const insertion = { parentId: parent?.id || null, index: parent ? (parent.children?.length || 0) : runtime.document.data.children.length };
        const cssBefore = builder.customCode.getCss();
        const cssAfter = ensureArchetypeCss(tokens);
        runtime.history.execute({
            label: `AI add ${name} section`,
            do: () => { runtime.document.insert(node, insertion); builder.customCode.update(cssAfter, builder.customCode.getJs()); },
            undo: () => { runtime.document.remove(node.id); builder.customCode.update(cssBefore, builder.customCode.getJs()); },
        });
        runtime.selection.select(node.id);
        return asJson({ ok: true, archetype: name, variant: built.variant, id: node.id, nodes: countSpec(built.spec) });
    };

    const setDesignTokens = (args) => {
        const current = liveTokens();
        const tokens = applyDesignTokens({ runtime, customCode: builder.customCode }, normalizeTokens({
            ...current,
            ...(args.tokens || {}),
            colors: { ...current.colors, ...(args.tokens?.colors || {}) },
            typography: { ...current.typography, ...(args.tokens?.typography || {}) },
            shape: { ...current.shape, ...(args.tokens?.shape || {}) },
            spacing: { ...current.spacing, ...(args.tokens?.spacing || {}) },
            motion: { ...current.motion, ...(args.tokens?.motion || {}) },
        }), { label: 'AI set design tokens', commit: updateCustomCode });
        return asJson({ ok: true, tokens, summary: describeTokens(tokens) });
    };

    const cssEdit = (selector, property, value) => {
        let css = builder.customCode.getCss();
        const blockRe = new RegExp(`(${escapeRegExp(selector)}\\s*\\{)([^}]*)(\\})`, 'm');
        const match = blockRe.exec(css);
        if (match) {
            const declaration = new RegExp(`(${escapeRegExp(property)}\\s*:\\s*)[^;\\n]+`, 'i');
            const body = declaration.test(match[2]) ? match[2].replace(declaration, `$1${value}`) : `${match[2].trimEnd()}\n  ${property}: ${value};`;
            css = css.replace(blockRe, `${match[1]}${body}${match[3]}`);
        } else {
            css = `${css.trimEnd()}\n${selector} {\n  ${property}: ${value};\n}`.trim();
        }
        updateCustomCode(css, builder.customCode.getJs(), 'AI edit custom CSS');
        return { ok: true };
    };

    // Every rule the page is compiled against, as one string: the page's own CSS plus the canvas
    // vocabulary it sits inside. Cross-origin sheets (Google Fonts) are skipped rather than thrown.
    const stylesheetText = () => {
        let text = builder.customCode.getCss();
        const doc = builder.iframeDoc;
        if (doc) [...doc.styleSheets].forEach((sheet) => {
            try { [...sheet.cssRules].forEach((rule) => { text += rule.cssText; }); } catch { /* cross-origin */ }
        });
        return text;
    };

    const auditDesign = () => {
        const root = builder.canvasRoot;
        const elements = root ? [...root.querySelectorAll('[data-ink-element-id]')] : [];
        const roots = runtime.document.data.children;
        const allNodes = [];
        const visit = (node) => { allNodes.push(node); (node.children || []).forEach(visit); };
        roots.forEach(visit);
        const issues = [];
        const h1s = root ? root.querySelectorAll('h1').length : 0;
        const actions = root ? [...root.querySelectorAll('a[href], button, [role="button"]')]
            .filter((element) => !element.closest('[data-ink-editor-only]') && !element.closest('.ink-editor-overlay')).length : 0;
        const emptyContainers = allNodes.filter((node) => runtime.elements.get(node.type).acceptsChildren && !['frame', 'shader'].includes(node.type) && !(node.children || []).length).length;
        const sectionLike = allNodes.filter((node) => ['section', 'container', 'frame'].includes(node.type)).length;
        const rootRect = root?.getBoundingClientRect();
        const overflow = rootRect ? elements.filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.right > rootRect.right + 2 || rect.left < rootRect.left - 2;
        }).slice(0, 8).map((element) => ({ id: element.dataset.inkElementId, type: element.dataset.inkElementType })) : [];
        const tinyText = elements.filter((element) => {
            const text = element.textContent?.trim();
            if (!text) return false;
            const size = Number.parseFloat(element.ownerDocument.defaultView.getComputedStyle(element).fontSize);
            return size > 0 && size < 12;
        }).slice(0, 8).map((element) => ({ id: element.dataset.inkElementId, type: element.dataset.inkElementType }));
        const collapsedHeadings = root ? [...root.querySelectorAll('h1,h2,h3')].filter((heading) => {
            const rect = heading.getBoundingClientRect();
            if (!rect.width || !rect.height || rect.width > rootRect.width * .55) return false;
            const styles = heading.ownerDocument.defaultView.getComputedStyle(heading);
            const lineHeight = Number.parseFloat(styles.lineHeight) || Number.parseFloat(styles.fontSize) * 1.1;
            return rect.height / Math.max(1, lineHeight) >= 5;
        }).slice(0, 8).map((heading) => ({ id: heading.closest('[data-ink-element-id]')?.dataset.inkElementId, text: heading.textContent.trim().slice(0, 60) })) : [];
        const narrowContent = elements.filter((element) => {
            if (element.dataset.inkElementType !== 'container' || (element.textContent?.trim().length || 0) < 100) return false;
            const parentElement = element.parentElement?.closest('[data-ink-element-id]');
            const parentInner = parentElement?.querySelector(':scope > .ink-el-container-inner');
            if (!parentInner || parentInner === element) return false;
            const parentStyles = parentInner.ownerDocument.defaultView.getComputedStyle(parentInner);
            const parentRect = parentInner.getBoundingClientRect();
            const rect = element.getBoundingClientRect();
            return parentStyles.display === 'flex' && parentStyles.flexDirection === 'column' && parentRect.width > 700 && rect.width < parentRect.width * .6;
        }).slice(0, 8).map((element) => ({ id: element.dataset.inkElementId, width: Math.round(element.getBoundingClientRect().width) }));
        if (h1s !== 1) issues.push({ severity: 'error', code: 'heading-hierarchy', message: `Expected exactly one H1; found ${h1s}.` });
        if (!actions) issues.push({ severity: 'warning', code: 'missing-action', message: 'No visible button or action link was found.' });
        if (sectionLike < 3) issues.push({ severity: 'warning', code: 'thin-page', message: `Only ${sectionLike} section/container elements were found.` });
        if (emptyContainers) issues.push({ severity: 'warning', code: 'empty-containers', message: `${emptyContainers} empty layout containers remain.` });
        if (overflow.length) issues.push({ severity: 'error', code: 'horizontal-overflow', message: `${overflow.length} sampled elements overflow the canvas.`, elements: overflow });
        if (tinyText.length) issues.push({ severity: 'warning', code: 'tiny-text', message: `${tinyText.length} sampled elements render below 12px.`, elements: tinyText });
        if (collapsedHeadings.length) issues.push({ severity: 'error', code: 'collapsed-headings', message: `${collapsedHeadings.length} headings wrap into five or more lines inside unusually narrow columns.`, elements: collapsedHeadings });
        if (narrowContent.length) issues.push({ severity: 'error', code: 'narrow-content-column', message: `${narrowContent.length} content containers occupy less than 60% of a wide column parent, leaving accidental dead space.`, elements: narrowContent });
        // The store-level rules read the same data the compiler does, so "it renders" and "it means
        // what the design says" are checked by one pass instead of by eye.
        const storeIssues = auditStore({ nodes: allNodes, cssText: stylesheetText(), diagnostics: runtime.styles?.diagnostics || [] });
        issues.push(...storeIssues);
        let score = 100;
        issues.forEach((issue) => { score -= issue.severity === 'error' ? 20 : 8; });
        return {
            score: Math.max(0, score),
            summary: { nodes: allNodes.length, roots: roots.length, sections: sectionLike, h1s, actions, emptyContainers, collapsedHeadings: collapsedHeadings.length, narrowContentColumns: narrowContent.length,
                uncompilableStyles: storeIssues.filter((issue) => issue.code === 'uncompilable-styles').length,
                inertClassHooks: (storeIssues.find((issue) => issue.code === 'inert-class-hooks')?.classes || []).length,
                glyphAsGraphic: storeIssues.filter((issue) => issue.code === 'glyph-as-graphic').length,
                customCssCharacters: builder.customCode.getCss().length, customJsCharacters: builder.customCode.getJs().length },
            issues,
            instruction: issues.length ? 'Fix the errors first, then warnings, and run audit_design again.' : 'The structural and rendered checks pass. Finish with a concise user-facing summary.',
        };
    };

    // The media tools answer over the network, so their result is a Promise where every other
    // tool answers synchronously. settle() gives both the same shape: one JSON string.
    const settle = (promise) => promise.then(asJson).catch((error) => asJson({ ok: false, error: error.message }));

    const apply = (name, args = {}) => {
        try {
            const target = resolve(args.path || args.id);
            if ((args.path || args.id) && !target) throw new TypeError('Element not found; read_design for current IDs.');
            switch (name) {
                case 'get_capabilities': return asJson(capabilities());
                case 'read_design': return index();
                case 'get_editor_context': return asJson(context());
                case 'get_element_schema': {
                    if (!runtime.elements.has(args.type)) throw new TypeError(`Unknown element type: ${args.type}`);
                    const definition = runtime.elements.get(args.type);
                    return asJson({ ...compactDefinition(definition), controls: definition.controls.map((control) => Object.fromEntries(Object.entries(control).filter(([key]) => ['name', 'type', 'target', 'part', 'options', 'default', 'units', 'min', 'max', 'step', 'responsive', 'condition'].includes(key)))) });
                }
                case 'read_element': return target ? asJson({ id: target.node.id, type: target.node.type, settings: target.node.settings, styles: target.node.styles, children: (target.node.children || []).map(({ id, type }) => ({ id, type })) }) : asJson({ ok: false, error: 'Element not found' });
                case 'read_custom_code': return asJson({ css: builder.customCode.getCss(), js: builder.customCode.getJs() });
                case 'audit_design': return asJson(auditDesign());
                case 'search_icons': return asJson({ query: args.query, results: searchIcons(args.query, Number(args.limit) || 24) });
                case 'list_media': return settle(listMedia(args));
                case 'search_images': return settle(searchImages(args));
                case 'generate_image': return settle(generateImage(args));
                case 'compose_landing_page': return asJson(composeLandingPage(args));
                case 'compose_page': return asJson(composeArchetypePage(args));
                case 'compose_section': return composeSection(args);
                case 'set_design_tokens': return setDesignTokens(args);
                case 'list_archetypes': return asJson({ archetypes: listArchetypes(), presets: presetNames(), currentTokens: describeTokens(liveTokens()), tokenNames: Object.keys(tokenVariables(DEFAULT_TOKENS)), guidance: 'Pass sections as [{ name, variant, content }] to compose_page, or one { archetype, variant, content } to compose_section. Set the palette once with set_design_tokens and every archetype section follows it.' });
                case 'set_shader_fill': {
                    if (!target) throw new Error('Select an existing layer for the shader fill.');
                    const fill = normalizeShader({ ...target.node.settings.shaderFill, ...(args.fill || {}), enabled: args.fill?.enabled !== false });
                    if (fill.preset === 'custom') validateCustomShader(fill.customCode);
                    runtime.update(target.node.id, { settings: { shaderFill: fill } }, 'AI shader fill');
                    return asJson({ ok: true, id: target.node.id, preset: fill.preset });
                }
                case 'replace_page': return asJson(replacePage(args));
                case 'append_tree': return asJson(appendTree(args));
                case 'insert_element': {
                    if (!runtime.elements.has(args.type)) return `unknown element type: ${args.type}`;
                    if (target && !runtime.elements.get(target.node.type).acceptsChildren) return 'target cannot contain children';
                    const node = runtime.insert(args.type, { parentId: target?.node.id || null, index: target ? (target.node.children?.length || 0) : runtime.document.data.children.length }, { settings: args.settings, styles: args.styles });
                    runtime.selection.select(node.id);
                    return asJson(withWarnings({ ok: true, id: node.id, type: node.type }, styleWarnings(args.styles)));
                }
                case 'update_element':
                    if (!target) return 'element not found';
                    runtime.update(target.node.id, { settings: args.settings || {} }, 'AI edit element'); return 'ok';
                case 'set_styles':
                    if (!target) return 'element not found';
                    runtime.update(target.node.id, { styles: args.styles || {} }, 'AI set styles');
                    return okUnlessWarned(styleWarnings(args.styles));
                case 'move_element': {
                    if (!target) return 'element not found';
                    const destination = resolve(args.targetPath || args.targetId);
                    if (!destination) return 'target not found';
                    const parentId = args.position === 'inside' ? destination.node.id : destination.parent?.id || null;
                    const siblings = parentId ? runtime.document.get(parentId)?.children || [] : runtime.document.data.children;
                    const insertionIndex = args.position === 'inside' ? siblings.length : siblings.findIndex((node) => node.id === destination.node.id) + (args.position === 'after' ? 1 : 0);
                    runtime.move(target.node.id, { parentId, index: Math.max(0, insertionIndex) }); return 'ok';
                }
                case 'remove_element': if (!target) return 'element not found'; runtime.remove(target.node.id); return 'ok';
                case 'duplicate_element': if (!target) return 'element not found'; runtime.duplicate(target.node.id); return 'ok';
                case 'set_custom_css':
                    if (typeof args.css !== 'string' || !args.css.trim()) return asJson({ ok: false, error: 'A non-empty css string is required; existing CSS was preserved.' });
                    updateCustomCode(args.css, builder.customCode.getJs()); return 'ok';
                case 'set_custom_js':
                    if (typeof args.js !== 'string') return asJson({ ok: false, error: 'A JavaScript string is required; existing JavaScript was preserved.' });
                    updateCustomCode(builder.customCode.getCss(), args.js); return 'ok';
                case 'css_edit':
                    if (!args.selector || !args.property || args.value == null) return 'selector, property and value are required';
                    return asJson(cssEdit(String(args.selector), String(args.property), String(args.value)));
                case 'set_interactions': {
                    const target = resolve(args.path || args.id);
                    if (!target) throw new TypeError('Element not found; read_design for current IDs.');
                    const requested = Array.isArray(args.interactions) ? args.interactions : [];
                    const interactions = normalizeInteractions(requested);
                    if (requested.length && !interactions.length) throw new TypeError('No usable interaction: each needs a valid on/action, and a state name for state actions.');
                    const settings = { interactions };
                    if (args.stateNames != null) settings.stateNames = normalizeStateList(args.stateNames);
                    if (args.state != null) settings.state = normalizeStateName(args.state);
                    runtime.update(target.node.id, { settings }, 'AI set interactions');
                    return asJson({ ok: true, id: target.node.id, interactions, stateNames: settings.stateNames, state: settings.state });
                }
                case 'set_motion_group': {
                    const target = resolve(args.path || args.id);
                    if (!target) throw new TypeError('Element not found; read_design for current IDs.');
                    const group = args.motionGroup == null ? null : normalizeMotionGroup(args.motionGroup);
                    if (args.motionGroup != null && !group) throw new TypeError('motionGroup must be an object with a valid kind and trigger.');
                    if (group && !runtime.elements.get(target.node.type).acceptsChildren) throw new TypeError(`${target.node.type} cannot own children, so it cannot orchestrate a timeline.`);
                    runtime.update(target.node.id, { settings: { motionGroup: group } }, group ? 'AI set motion group' : 'AI clear motion group');
                    return asJson({ ok: true, id: target.node.id, motionGroup: group, timeline: motionGroupItems(target.node), summary: group ? describeMotionGroup(group) : '' });
                }
                case 'set_sticky': {
                    const target = resolve(args.path || args.id);
                    if (!target) throw new TypeError('Element not found; read_design for current IDs.');
                    const enabled = args.sticky == null ? false : (args.sticky.enabled !== false && args.sticky !== false);
                    const sticky = enabled ? { enabled: true, top: Number(args.sticky.top) || 0, zIndex: Number(args.sticky.zIndex) || 10 } : null;
                    runtime.update(target.node.id, { settings: { sticky } }, sticky ? 'AI pin layer' : 'AI unpin layer');
                    return asJson({ ok: true, id: target.node.id, sticky });
                }
                case 'undo': runtime.history.undo(); return 'ok';
                case 'redo': runtime.history.redo(); return 'ok';
                default: return `unknown tool: ${name}`;
            }
        } catch (error) {
            return asJson({ ok: false, error: error.message });
        }
    };

    const treeNodeSchema = { type: 'object', properties: { type: { type: 'string' }, settings: { type: 'object', additionalProperties: true }, styles: { type: 'object', additionalProperties: true }, children: { type: 'array', items: { type: 'object', additionalProperties: true, description: 'Another native node with type, settings, styles, and optional children.' } } }, required: ['type'], description: 'Recursive native builder node. Use exact element types and setting names from capabilities.' };
    const TOOLS = [
        { name: 'set_shader_fill', description: 'Apply a preset or custom GLSL shader fill to an existing layer. fill accepts enabled, preset, colorA/colorB/colorC hex colors, animate, speed (0–2), intensity (0–1), grain (0–0.3), and customCode. For custom GLSL set preset custom and define vec4 inkShader(vec2 uv,float time,vec2 resolution); uniforms a,b,c and intensity are available. Code is compiled before mutation.', parameters: { type: 'object', properties: { id: { type: 'string' }, fill: { type: 'object', additionalProperties: true } }, required: ['id','fill'] } },
        { name: 'get_capabilities', description: 'Return every available builder element grouped by category, its editable setting names/defaults, the responsive style shape, and custom-code support. Call this before composing a page.', parameters: { type: 'object', properties: {} } },
        { name: 'search_icons', description: 'Search the builder icon libraries (Material Symbols, Lucide, Phosphor) by name or keyword and return storable values. Call this before setting an icon: a bare name must be a real Material Symbols ligature, while a Lucide or Phosphor icon is stored as "lucide:eye-off". An unresolved name renders as its literal text.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Name or keyword, e.g. "eye", "user check", "shield".' }, limit: { type: 'number', description: 'Maximum results (default 24).' } }, required: ['query'] } },
        { name: 'get_editor_context', description: 'Read selected layer IDs, current breakpoint, page settings, and viewport before context-dependent edits.', parameters: { type: 'object', properties: {} } },
        { name: 'get_element_schema', description: 'Return the exact control schema for one element type, including options, conditions, targets, and responsive support. Use to configure layout, interaction, or advanced properties without guessing.', parameters: { type: 'object', properties: { type: { type: 'string' } }, required: ['type'] } },
        { name: 'read_design', description: 'Return the current page as a numbered tree. Call before a targeted edit.', parameters: { type: 'object', properties: {} } },
        { name: 'read_element', description: 'Return one element settings and responsive styles.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' } } } },
        { name: 'read_custom_code', description: 'Return current page-level CSS and JavaScript.', parameters: { type: 'object', properties: {} } },
        { name: 'audit_design', description: 'Inspect the live rendered canvas for hierarchy, calls to action, empty containers, tiny text, horizontal overflow, and custom-code usage. Run after composing and after final corrections.', parameters: { type: 'object', properties: {} } },
        { name: 'compose_landing_page', description: 'Optional portfolio template. Compose an editable landing page from a fixed hero/work/proof/process structure. Use replace_page for original compositions, product UI, dashboards, apps, or reference-specific designs. Supply specific copy; the browser expands it into native builder primitives, polished responsive CSS, and one atomic undo step.', parameters: { type: 'object', properties: {
            siteName: { type: 'string' }, palette: { type: 'object', properties: { background: { type: 'string' }, surface: { type: 'string' }, text: { type: 'string' }, muted: { type: 'string' }, accent: { type: 'string' } } },
            navLabel: { type: 'string' }, contactLabel: { type: 'string' },
            hero: { type: 'object', properties: { eyebrow: { type: 'string' }, headline: { type: 'string' }, body: { type: 'string' }, asideLabel: { type: 'string' }, asideTitle: { type: 'string' }, asideBody: { type: 'string' }, primaryCta: { type: 'object' }, secondaryCta: { type: 'object' } }, required: ['headline', 'body'] },
            workEyebrow: { type: 'string' }, workHeading: { type: 'string' }, workBody: { type: 'string' }, projects: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'object', properties: { eyebrow: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' }, outcome: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['title', 'summary', 'outcome'] } },
            proof: { type: 'object', properties: { eyebrow: { type: 'string' }, heading: { type: 'string' }, body: { type: 'string' }, quote: { type: 'string' }, quoteName: { type: 'string' }, quoteRole: { type: 'string' }, stats: { type: 'array', items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } }, required: ['value', 'label'] } } } },
            process: { type: 'object', properties: { eyebrow: { type: 'string' }, heading: { type: 'string' }, body: { type: 'string' }, steps: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'body'] } } } },
            faq: { type: 'object', properties: { eyebrow: { type: 'string' }, heading: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } }, required: ['title', 'content'] } } } },
            closing: { type: 'object', properties: { eyebrow: { type: 'string' }, headline: { type: 'string' }, body: { type: 'string' }, cta: { type: 'object' } }, required: ['headline', 'body'] },
            footer: { type: 'object', properties: { copyright: { type: 'string' }, links: { type: 'array', items: { type: 'string' } } } },
        }, required: ['siteName', 'hero', 'projects', 'proof', 'process', 'closing'] } },
        { name: 'compose_page', description: 'Compose a whole page from named section archetypes as one undoable change. sections is an array of { name, variant, content } (a bare name string is also accepted); content fills the section (title, lede, cta, items, plans, faq, ...). tokens overrides the design tokens for this page, or preset names one of the built-in themes. Call list_archetypes first for names, variants and token names.', parameters: { type: 'object', properties: { sections: { type: 'array', items: { type: 'object', additionalProperties: true } }, content: { type: 'object', additionalProperties: true }, tokens: { type: 'object', additionalProperties: true }, preset: { type: 'string' }, customJs: { type: 'string' } } } },
        { name: 'compose_section', description: 'Append one named archetype section to the page (or inside a path/id). archetype is a name from list_archetypes; variant selects the layout; content fills it; tokens override the palette. The section is real, editable elements and the archetype CSS is installed if missing.', parameters: { type: 'object', properties: { archetype: { type: 'string' }, variant: { type: 'string' }, content: { type: 'object', additionalProperties: true }, tokens: { type: 'object', additionalProperties: true }, path: { type: 'string' }, id: { type: 'string' }, sticky: { type: 'boolean' } }, required: ['archetype'] } },
        { name: 'set_design_tokens', description: 'Set the page design tokens (the design system). tokens is { colors: { background, surface, text, muted, accent, accentContrast, border }, typography: { fontFamily, headingFamily, baseSize, scale, lineHeight, headingWeight, headingTracking, textWidth }, shape: { radius, radiusSmall, borderWidth }, spacing: { contentWidth, pageGutter, sectionGap, blockGap, sectionPadding }, motion: { duration, easing, stagger } }. Writes the page theme, the CSS custom properties AND the stylesheet that consumes them (headings, paragraphs and links follow the type scale and palette), so setting the palette once styles archetype sections and raw elements alike. Set this before composing.', parameters: { type: 'object', properties: { tokens: { type: 'object', additionalProperties: true } }, required: ['tokens'] } },
        { name: 'list_archetypes', description: 'List the named section archetypes and their variants, the built-in theme presets, and the current design tokens. Call before composing.', parameters: { type: 'object', properties: {} } },
        { name: 'replace_page', description: 'Compose an original page or app interface as a complete recursive native element tree in one undo step. Use responsive node styles for editable layout, typography, fills, and effects; optional custom CSS/JS enhances the native elements. Preserve existing content unless the request calls for replacement.', parameters: { type: 'object', properties: { settings: { type: 'object' }, children: { type: 'array', items: treeNodeSchema }, customCss: { type: 'string' }, customJs: { type: 'string' } }, required: ['children'] } },
        { name: 'append_tree', description: 'Append one complete recursive layout tree at the root or inside a container. Preferred for an Add section request.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' }, tree: treeNodeSchema }, required: ['tree'] } },
        { name: 'insert_element', description: 'Insert one element for a small surgical edit. For sections or complete pages use append_tree or replace_page.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' }, type: { type: 'string' }, settings: { type: 'object' }, styles: { type: 'object' } }, required: ['type'] } },
        { name: 'update_element', description: 'Change an element settings such as copy, tag, URL, icon, or CSS classes.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' }, settings: { type: 'object' } }, required: ['settings'] } },
        { name: 'set_styles', description: 'Merge responsive styles into one element. Shape is {desktop:{base:{}},tablet:{base:{}},mobile:{base:{}}}.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' }, styles: { type: 'object' } }, required: ['styles'] } },
        { name: 'move_element', description: 'Move an element before, after, or inside another element.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' }, targetPath: { type: 'string' }, targetId: { type: 'string' }, position: { type: 'string', enum: ['before', 'after', 'inside'] } }, required: ['position'] } },
        { name: 'remove_element', description: 'Remove an element and its children.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' } } } },
        { name: 'duplicate_element', description: 'Duplicate an element as a sibling.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' } } } },
        { name: 'set_custom_css', description: 'Replace page-level custom CSS. Scope design classes under .ink-canvas-root and preserve responsive behavior.', parameters: { type: 'object', properties: { css: { type: 'string' } }, required: ['css'] } },
        { name: 'set_custom_js', description: 'Replace page-level JavaScript for progressive motion, interaction, canvas, WebGL, or shaders. Keep it idempotent and scoped to the page.', parameters: { type: 'object', properties: { js: { type: 'string' } }, required: ['js'] } },
        { name: 'css_edit', description: 'Set one custom-CSS property on one selector.', parameters: { type: 'object', properties: { selector: { type: 'string' }, property: { type: 'string' }, value: { type: 'string' } }, required: ['selector', 'property', 'value'] } },
        { name: 'set_interactions', description: 'Set declarative interactions and/or component-state names on one element. interactions is an array of { on: click|hover|load|enter, action: toggleState|setState|toggleClass|show|hide|scrollTo|playMotion, target: self|parent|next|previous|query|children, state, className, selector, exclusive, delay }. stateNames names this layer\'s variants and state picks the authored one. Everything stays editable in the Interaction panel and runs in Preview/published output.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' }, interactions: { type: 'array', items: { type: 'object', additionalProperties: true } }, stateNames: { type: 'array', items: { type: 'string' } }, state: { type: 'string' } } } },
        { name: 'set_motion_group', description: 'Orchestrate the children of one layer as a single editable timeline. motionGroup is { kind: group|stagger|unfold|orbit3d|scrub|carousel, trigger: inherit|load|enter|hover|scroll, stagger, duration, delay, easing, iterations, perspective, scrub: { reference: group|parent, start, end }, pin: { enabled, distance } }. Children keep their own keyframes; the group shares the trigger and staggers their starts. Pass motionGroup null to clear it. Use set_sticky on the stage for a pinned scroll timeline.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' }, motionGroup: { type: 'object', additionalProperties: true } } } },
        { name: 'set_sticky', description: 'Pin a layer inside its scroll container (position: sticky). sticky is { enabled, top, zIndex }; pass sticky null or false to unpin.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' }, sticky: { type: 'object', additionalProperties: true } } } },
        { name: 'undo', description: 'Undo the last builder or Copilot change.', parameters: { type: 'object', properties: {} } },
        { name: 'redo', description: 'Redo the last undone change.', parameters: { type: 'object', properties: {} } },
    ];

    const MUTATING_TOOLS = new Set(['set_shader_fill', 'set_interactions', 'set_motion_group', 'set_sticky', 'compose_landing_page', 'compose_page', 'compose_section', 'set_design_tokens', 'replace_page', 'append_tree', 'insert_element', 'update_element', 'set_styles', 'move_element', 'remove_element', 'duplicate_element', 'set_custom_css', 'set_custom_js', 'css_edit', 'undo', 'redo']);
    const context = () => ({
        selection: [...runtime.selection.selectedIds].map((id) => { const node = runtime.document.get(id); return node ? { id, type: node.type, label: node.settings.label || labelOf(node) } : null; }).filter(Boolean),
        device: runtime.responsive.device,
        viewport: { width: builder.iframe?.clientWidth, height: builder.iframe?.clientHeight },
        page: clone(runtime.document.data.settings),
        guidance: 'Selected IDs identify this/these layers. Preserve the existing page for targeted edits. Use responsive native styles so inspector controls remain authoritative.',
    });
    const execute = (name, args = {}) => {
        let mutated = false;
        const off = runtime.events.on('history:change', () => { mutated = true; });
        const settleExecution = (content) => { off(); return { content: String(content), mutated }; };
        const content = apply(name, args);
        return content instanceof Promise ? content.then(settleExecution) : settleExecution(content);
    };
    // TOOLS is read when a Copilot request is sent, so the media tools appear exactly when the
    // site can serve them: the library list always, generate_image only once an image model is
    // configured. Advertising a tool the server cannot fulfil stalls a design run.
    return {
        apply, execute, context, index, resolve, MUTATING_TOOLS,
        get TOOLS() { return TOOLS.concat(availableMediaTools()); },
        isMutation: (name) => MUTATING_TOOLS.has(name),
    };
}
