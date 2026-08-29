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
const asJson = (value) => JSON.stringify(value, null, 2);

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

    const indexNode = (node, path) => {
        const definition = runtime.elements.get(node.type);
        const lines = [`[${path}] ${definition.title}${labelOf(node)} (type ${node.type}, id ${node.id})`];
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
            (groups[category] ||= []).push(compactDefinition(definition));
        });
        return {
            documentVersion: 2,
            elements: groups,
            styleShape: { desktop: { base: { color: '#111827', padding: { top: 24, right: 24, bottom: 24, left: 24, unit: 'px' } } }, tablet: { base: {} }, mobile: { base: {} } },
            customCode: { css: true, javascript: true, designKitClasses: true, maximumCharactersEach: MAX_CUSTOM_CODE_LENGTH },
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

    const countSpec = (spec) => 1 + (Array.isArray(spec?.children) ? spec.children.reduce((sum, child) => sum + countSpec(child), 0) : 0);
    const materialize = (spec, parent = null) => {
        if (!spec || typeof spec !== 'object' || !spec.type) throw new TypeError('Every tree node requires a type.');
        if (!runtime.elements.has(spec.type)) throw new TypeError(`Unknown element type: ${spec.type}`);
        if (runtime.elements.get(spec.type).internal) throw new TypeError(`${spec.type} is an editor-only organizational layer; compose visual layouts with Frames instead.`);
        const definition = runtime.elements.get(spec.type);
        if (spec.children?.length && !definition.acceptsChildren) throw new TypeError(`${spec.type} cannot contain children.`);
        const node = runtime.create(spec.type, { settings: spec.settings || {}, styles: spec.styles || {} });
        if (parent && !runtime.elements.accepts(parent, node)) throw new TypeError(`${parent.type} cannot contain ${node.type}.`);
        if (definition.acceptsChildren) node.children = (spec.children || []).map((child) => materialize(child, node));
        return node;
    };

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
        if (!Array.isArray(args.children) || !args.children.length) throw new TypeError('replace_page requires a non-empty children array; the existing page was preserved.');
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
        return { ok: true, nodes: nodeCount, roots: children.length, message: 'Page composed as one undoable change.' };
    };

    const appendTree = (args) => {
        const total = countSpec(args.tree);
        if (total > MAX_TREE_NODES) throw new RangeError(`Tree has ${total} nodes; maximum is ${MAX_TREE_NODES}.`);
        const target = resolve(args.path || args.id);
        const parent = target?.node || null;
        if (parent && !runtime.elements.get(parent.type).acceptsChildren) throw new TypeError('Target cannot contain children.');
        const node = materialize(args.tree, parent);
        const insertion = { parentId: parent?.id || null, index: parent ? (parent.children?.length || 0) : runtime.document.data.children.length };
        runtime.history.execute({ label: 'AI add layout', do: () => runtime.document.insert(node, insertion), undo: () => runtime.document.remove(node.id) });
        runtime.selection.select(node.id);
        return { ok: true, nodes: total, id: node.id };
    };

    const composeLandingPage = (args) => {
        const clean = (value, fallback = '') => String(value == null ? fallback : value).trim();
        const color = (value, fallback) => /^#[0-9a-f]{3,8}$/i.test(clean(value)) ? clean(value) : fallback;
        const itemList = (value, fallback = []) => Array.isArray(value) && value.length ? value : fallback;
        const node = (type, settings = {}, children = []) => ({ type, settings, ...(children.length ? { children } : {}) });
        const container = (className, children, tag = 'div') => node('container', { tag, layout: 'full', cssClasses: className }, children);
        const heading = (text, tag, className) => node('heading', { text: clean(text), tag, cssClasses: className });
        const paragraph = (text, className) => node('paragraph', { text: clean(text), cssClasses: className });
        const button = (cta, className) => node('button', { text: clean(cta?.label, 'Learn more'), url: clean(cta?.url, '#contact'), cssClasses: className });
        const section = (className, children) => container(`cp-section ${className}`, [container('cp-shell', children)], 'section');

        const palette = {
            background: color(args.palette?.background, '#f4efe6'),
            surface: color(args.palette?.surface, '#fffaf2'),
            text: color(args.palette?.text, '#171512'),
            muted: color(args.palette?.muted, '#6f685e'),
            accent: color(args.palette?.accent, '#f04e3e'),
        };
        const hero = args.hero || {};
        const projects = itemList(args.projects, [
            { eyebrow: 'Selected work · 01', title: 'A calmer way through complex work', summary: 'A focused product system that turns a fragmented workflow into one confident path.', outcome: 'Clearer decisions, fewer handoffs', tags: ['Strategy', 'Product design'] },
            { eyebrow: 'Selected work · 02', title: 'Trust designed into every detail', summary: 'A service experience rebuilt around legibility, momentum, and human reassurance.', outcome: 'A launch teams could stand behind', tags: ['Research', 'Design systems'] },
        ]).slice(0, 4);
        const proof = args.proof || {};
        const stats = itemList(proof.stats, [
            { value: 'End to end', label: 'from the first question through the shipped system' },
            { value: 'Direct', label: 'senior design attention throughout the engagement' },
            { value: 'Built to ship', label: 'decisions documented so the team can carry them forward' },
        ]).slice(0, 4);
        const process = args.process || {};
        const steps = itemList(process.steps, [
            { title: 'Find the signal', body: 'Research the real constraint, align the room, and name the opportunity clearly.' },
            { title: 'Make it tangible', body: 'Prototype the critical experience early enough for evidence to change the work.' },
            { title: 'Ship the system', body: 'Resolve the details, document the logic, and help the team carry it forward.' },
        ]).slice(0, 5);
        const closing = args.closing || {};
        const faqItems = itemList(args.faq?.items).slice(0, 6);

        const nav = container('cp-nav', [
            paragraph(clean(args.siteName, 'Mara Vale'), 'cp-wordmark'),
            container('cp-nav-actions', [
                button({ label: clean(args.navLabel, 'Selected work'), url: '#work' }, 'cp-link-button'),
                button({ label: clean(args.contactLabel, 'Start a project'), url: '#contact' }, 'cp-link-button cp-link-button-accent'),
            ]),
        ], 'nav');
        const heroSection = section('cp-hero', [
            nav,
            container('cp-hero-grid', [
                container('cp-hero-copy', [
                    paragraph(clean(hero.eyebrow, 'Independent product designer · Available for select collaborations'), 'cp-kicker'),
                    heading(clean(hero.headline, 'Designing products people can feel their way through.'), 'h1', 'cp-display'),
                    paragraph(clean(hero.body, 'I help ambitious teams turn complex ideas into clear, characterful products—from first principle to shipped system.'), 'cp-lede'),
                    container('cp-actions', [
                        button(hero.primaryCta || { label: 'Discuss a project', url: '#contact' }, 'cp-primary'),
                        button(hero.secondaryCta || { label: 'View selected work', url: '#work' }, 'cp-secondary'),
                    ]),
                ]),
                container('cp-hero-aside', [
                    paragraph(clean(hero.asideLabel, 'CURRENTLY'), 'cp-micro'),
                    heading(clean(hero.asideTitle, 'Making ambitious software feel inevitable.'), 'h2', 'cp-aside-title'),
                    paragraph(clean(hero.asideBody, 'Strategy, product design, prototyping, and systems for teams at an inflection point.'), 'cp-muted'),
                ]),
            ]),
        ]);
        const workSection = section('cp-work', [
            node('anchor', { id: 'work', offset: 72 }),
            container('cp-section-head', [
                paragraph(clean(args.workEyebrow, 'Selected work'), 'cp-kicker'),
                heading(clean(args.workHeading, 'Proof, not decoration.'), 'h2', 'cp-section-title'),
                paragraph(clean(args.workBody, 'A few recent engagements where product clarity became a competitive advantage.'), 'cp-section-intro'),
            ]),
            container('cp-project-grid', projects.map((project, index) => container(`cp-project cp-project-${index + 1}`, [
                container('cp-project-visual', [
                    paragraph(String(index + 1).padStart(2, '0'), 'cp-project-number'),
                    paragraph(clean(project.outcome, 'Designed for meaningful momentum'), 'cp-project-outcome'),
                ]),
                container('cp-project-copy', [
                    paragraph(clean(project.eyebrow, `Case study · 0${index + 1}`), 'cp-micro'),
                    heading(clean(project.title, 'A product story with a clear point of view'), 'h3', 'cp-project-title'),
                    paragraph(clean(project.summary, 'A specific product challenge translated into a coherent experience and durable system.'), 'cp-muted'),
                    paragraph(itemList(project.tags, ['Product design']).map(clean).join(' · '), 'cp-tags'),
                ]),
            ], 'article'))),
        ]);
        const proofSection = section('cp-proof', [
            container('cp-proof-copy', [
                paragraph(clean(proof.eyebrow, 'Why teams call again'), 'cp-kicker'),
                heading(clean(proof.heading, 'Senior thinking, close to the work.'), 'h2', 'cp-section-title'),
                paragraph(clean(proof.body, 'I work directly with founders and product teams, bringing research, interaction, visual systems, and prototyping into one continuous design practice.'), 'cp-lede'),
                node('testimonial', {
                    quote: clean(proof.quote, 'Mara gave the product a point of view without losing sight of what customers actually needed.'),
                    name: clean(proof.quoteName, 'Product lead'),
                    role: clean(proof.quoteRole, 'Series A technology company'),
                    cssClasses: 'cp-testimonial',
                }),
            ]),
            container('cp-stats', stats.map((stat) => container('cp-stat', [
                heading(clean(stat.value, '—'), 'h3', 'cp-stat-value'),
                paragraph(clean(stat.label, 'A useful measure of the practice'), 'cp-stat-label'),
            ]))),
        ]);
        const processSection = section('cp-process', [
            container('cp-section-head', [
                paragraph(clean(process.eyebrow, 'How the work moves'), 'cp-kicker'),
                heading(clean(process.heading, 'Clarity is a process.'), 'h2', 'cp-section-title'),
                paragraph(clean(process.body, 'Enough structure to move with confidence; enough openness to discover the better answer.'), 'cp-section-intro'),
            ]),
            container('cp-steps', steps.map((step, index) => container('cp-step', [
                paragraph(String(index + 1).padStart(2, '0'), 'cp-step-number'),
                heading(clean(step.title, 'A focused step'), 'h3', 'cp-step-title'),
                paragraph(clean(step.body, 'A concise explanation of what happens and why it matters.'), 'cp-muted'),
            ]))),
        ]);
        const optionalFaq = faqItems.length ? [section('cp-faq', [
            container('cp-section-head', [paragraph(clean(args.faq.eyebrow, 'Good to know'), 'cp-kicker'), heading(clean(args.faq.heading, 'Before we begin.'), 'h2', 'cp-section-title')]),
            node('accordion', { items: faqItems.map((item) => ({ title: clean(item.title), content: clean(item.content) })), cssClasses: 'cp-accordion' }),
        ])] : [];
        const closingSection = section('cp-closing', [
            node('anchor', { id: 'contact', offset: 72 }),
            paragraph(clean(closing.eyebrow, 'Have a meaningful problem?'), 'cp-kicker'),
            heading(clean(closing.headline, 'Let’s make the next version impossible to ignore.'), 'h2', 'cp-closing-title'),
            paragraph(clean(closing.body, 'Share what you are building, where it feels stuck, and what a strong outcome would change.'), 'cp-closing-body'),
            container('cp-actions', [button(closing.cta || { label: 'Start a conversation', url: 'mailto:hello@example.com' }, 'cp-primary cp-primary-light')]),
            container('cp-footer', [
                paragraph(clean(args.footer?.copyright, `© ${new Date().getFullYear()} ${clean(args.siteName, 'Mara Vale')}`), 'cp-footer-copy'),
                paragraph(itemList(args.footer?.links, ['LinkedIn', 'Are.na', 'Email']).map(clean).join('  ·  '), 'cp-footer-links'),
            ], 'footer'),
        ]);

        const customCss = `
.ink-canvas-root { --cp-bg:${palette.background}; --cp-surface:${palette.surface}; --cp-ink:${palette.text}; --cp-muted:${palette.muted}; --cp-accent:${palette.accent}; background:var(--cp-bg); color:var(--cp-ink); }
.ink-canvas-root .ink-el-container[class*="cp-"] { min-width:0; max-width:100%; }
.ink-canvas-root .ink-el-container[class*="cp-"] > .ink-el-container-inner { min-width:0; width:100%; }
.ink-canvas-root [class*="cp-"] :where(h1,h2,h3,h4,h5,h6,p) { overflow-wrap:normal; word-break:normal; }
.ink-canvas-root .cp-section { position:relative; width:100%; background:var(--cp-bg); color:var(--cp-ink); overflow:hidden; }
.ink-canvas-root .cp-shell { width:min(100% - 48px, 1180px); margin-inline:auto; padding:clamp(72px,9vw,144px) 0; }
.ink-canvas-root .cp-hero .cp-shell { min-height:min(900px,100svh); padding-top:24px; display:flex; flex-direction:column; }
.ink-canvas-root .cp-nav { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:0 0 clamp(72px,10vw,150px); }
.ink-canvas-root .cp-wordmark { margin:0; font:700 17px/1.1 Inter,system-ui,sans-serif; letter-spacing:-.03em; }
.ink-canvas-root .cp-nav-actions,.ink-canvas-root .cp-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.ink-canvas-root .cp-link-button,.ink-canvas-root .cp-primary,.ink-canvas-root .cp-secondary { min-height:46px; border-radius:999px; padding:13px 20px; border:1px solid color-mix(in srgb,var(--cp-ink) 18%,transparent); font:650 14px/1 Inter,system-ui,sans-serif; letter-spacing:-.01em; transition:transform .25s ease,background .25s ease,color .25s ease; }
.ink-canvas-root .cp-link-button { min-height:38px; padding:10px 15px; background:transparent; color:var(--cp-ink); border-color:transparent; }
.ink-canvas-root .cp-link-button-accent,.ink-canvas-root .cp-primary { background:var(--cp-accent); color:#fff; border-color:var(--cp-accent); }
.ink-canvas-root .cp-secondary { background:transparent; color:var(--cp-ink); }
.ink-canvas-root .cp-link-button:hover,.ink-canvas-root .cp-primary:hover,.ink-canvas-root .cp-secondary:hover { transform:translateY(-2px); }
.ink-canvas-root .cp-hero-grid { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(260px,.55fr); gap:clamp(48px,9vw,130px); align-items:end; flex:1; padding-bottom:clamp(28px,5vw,72px); }
.ink-canvas-root .cp-hero-copy { display:flex; flex-direction:column; align-items:flex-start; }
.ink-canvas-root .cp-kicker,.ink-canvas-root .cp-micro { margin:0 0 22px; color:var(--cp-muted); font:700 12px/1.3 Inter,system-ui,sans-serif; letter-spacing:.12em; text-transform:uppercase; }
.ink-canvas-root .cp-display { max-width:980px; margin:0; font:500 clamp(58px,8.6vw,132px)/.88 Georgia,'Times New Roman',serif; letter-spacing:-.065em; text-wrap:balance; }
.ink-canvas-root .cp-display em { color:var(--cp-accent); }
.ink-canvas-root .cp-lede { max-width:680px; margin:34px 0 32px; font:400 clamp(18px,2vw,24px)/1.45 Inter,system-ui,sans-serif; letter-spacing:-.025em; }
.ink-canvas-root .cp-hero-aside { border-top:1px solid color-mix(in srgb,var(--cp-ink) 22%,transparent); padding-top:22px; }
.ink-canvas-root .cp-aside-title { margin:0 0 16px; font:500 clamp(25px,3vw,38px)/1.05 Georgia,serif; letter-spacing:-.04em; }
.ink-canvas-root .cp-muted,.ink-canvas-root .cp-section-intro,.ink-canvas-root .cp-stat-label { color:var(--cp-muted); font:400 17px/1.6 Inter,system-ui,sans-serif; }
.ink-canvas-root .cp-section-head { display:grid; grid-template-columns:1fr 1.4fr; column-gap:7vw; align-items:start; margin-bottom:clamp(42px,7vw,84px); }
.ink-canvas-root .cp-section-head .cp-kicker { grid-row:1 / span 2; }
.ink-canvas-root .cp-section-title { margin:0; font:500 clamp(44px,6.5vw,88px)/.96 Georgia,serif; letter-spacing:-.055em; text-wrap:balance; }
.ink-canvas-root .cp-section-intro { max-width:620px; margin:24px 0 0; }
.ink-canvas-root .cp-work { background:var(--cp-surface); }
.ink-canvas-root .cp-project-grid { display:grid; grid-template-columns:1.15fr .85fr; gap:18px; }
.ink-canvas-root .cp-project { min-height:560px; display:flex; flex-direction:column; border:1px solid color-mix(in srgb,var(--cp-ink) 14%,transparent); border-radius:28px; overflow:hidden; background:var(--cp-bg); }
.ink-canvas-root .cp-project:nth-child(3n) { grid-column:1 / -1; display:grid; grid-template-columns:1.1fr .9fr; min-height:420px; }
.ink-canvas-root .cp-project-visual { min-height:300px; padding:28px; display:flex; justify-content:space-between; align-items:flex-end; color:#fff; background:radial-gradient(circle at 72% 20%,color-mix(in srgb,var(--cp-accent) 88%,white),transparent 28%),var(--cp-ink); }
.ink-canvas-root .cp-project:nth-child(2n) .cp-project-visual { background:var(--cp-accent); }
.ink-canvas-root .cp-project-number { margin:0; font:500 clamp(64px,9vw,130px)/.8 Georgia,serif; letter-spacing:-.07em; opacity:.95; }
.ink-canvas-root .cp-project-outcome { max-width:200px; margin:0; font:600 14px/1.35 Inter,sans-serif; text-align:right; }
.ink-canvas-root .cp-project-copy { padding:30px; }
.ink-canvas-root .cp-project-title { margin:0 0 16px; font:500 clamp(30px,4vw,52px)/1 Georgia,serif; letter-spacing:-.045em; }
.ink-canvas-root .cp-tags { margin:24px 0 0; color:var(--cp-ink); font:650 12px/1.4 Inter,sans-serif; letter-spacing:.08em; text-transform:uppercase; }
.ink-canvas-root .cp-proof .cp-shell { display:grid; grid-template-columns:1.15fr .85fr; gap:clamp(50px,9vw,130px); align-items:start; }
.ink-canvas-root .cp-proof-copy { display:flex; flex-direction:column; align-items:flex-start; }
.ink-canvas-root .cp-testimonial { margin-top:42px; border-left:3px solid var(--cp-accent); padding-left:24px; }
.ink-canvas-root .cp-stats { display:grid; border-top:1px solid color-mix(in srgb,var(--cp-ink) 18%,transparent); }
.ink-canvas-root .cp-stat { display:grid; grid-template-columns:.65fr 1fr; gap:24px; align-items:baseline; padding:28px 0; border-bottom:1px solid color-mix(in srgb,var(--cp-ink) 18%,transparent); }
.ink-canvas-root .cp-stat-value { margin:0; color:var(--cp-accent); font:500 clamp(42px,5vw,72px)/.9 Georgia,serif; letter-spacing:-.05em; }
.ink-canvas-root .cp-process { background:var(--cp-ink); color:var(--cp-bg); }
.ink-canvas-root .cp-process .cp-muted,.ink-canvas-root .cp-process .cp-section-intro,.ink-canvas-root .cp-process .cp-kicker { color:color-mix(in srgb,var(--cp-bg) 70%,transparent); }
.ink-canvas-root .cp-steps { display:grid; grid-template-columns:repeat(3,1fr); border-top:1px solid color-mix(in srgb,var(--cp-bg) 20%,transparent); }
.ink-canvas-root .cp-step { padding:30px 30px 30px 0; border-right:1px solid color-mix(in srgb,var(--cp-bg) 20%,transparent); }
.ink-canvas-root .cp-step + .cp-step { padding-left:30px; }
.ink-canvas-root .cp-step:last-child { border-right:0; }
.ink-canvas-root .cp-step-number { color:var(--cp-accent); font:700 12px/1 Inter,sans-serif; }
.ink-canvas-root .cp-step-title { margin:60px 0 18px; font:500 clamp(28px,3.5vw,44px)/1 Georgia,serif; letter-spacing:-.04em; }
.ink-canvas-root .cp-accordion { max-width:820px; margin-left:auto; }
.ink-canvas-root .cp-closing { background:var(--cp-accent); color:#fff; }
.ink-canvas-root .cp-closing .cp-shell { min-height:720px; display:flex; flex-direction:column; justify-content:center; align-items:flex-start; }
.ink-canvas-root .cp-closing .cp-kicker { color:color-mix(in srgb,#fff 78%,transparent); }
.ink-canvas-root .cp-closing-title { max-width:1020px; margin:0; font:500 clamp(54px,8vw,112px)/.9 Georgia,serif; letter-spacing:-.065em; text-wrap:balance; }
.ink-canvas-root .cp-closing-body { max-width:620px; margin:30px 0; font:400 20px/1.5 Inter,sans-serif; }
.ink-canvas-root .cp-primary-light { background:#fff; color:var(--cp-ink); border-color:#fff; }
.ink-canvas-root .cp-footer { width:100%; display:flex; justify-content:space-between; gap:24px; margin-top:auto; padding-top:80px; font:600 13px/1.4 Inter,sans-serif; }
/* Container roots own surfaces; their immediate inner wrappers own child flow. */
.ink-canvas-root .cp-section .ink-el-container-inner { max-width:none; width:100%; padding:0; gap:0; }
.ink-canvas-root .cp-shell > .ink-el-container-inner { min-height:inherit; }
.ink-canvas-root .cp-nav > .ink-el-container-inner { display:flex; flex-direction:row; align-items:center; justify-content:space-between; gap:24px; }
.ink-canvas-root .cp-nav-actions > .ink-el-container-inner,.ink-canvas-root .cp-actions > .ink-el-container-inner { display:flex; flex-direction:row; align-items:center; gap:10px; flex-wrap:wrap; }
.ink-canvas-root .cp-hero .cp-shell > .ink-el-container-inner { min-height:inherit; display:flex; flex-direction:column; }
.ink-canvas-root .cp-hero-grid > .ink-el-container-inner { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(260px,.55fr); gap:clamp(48px,9vw,130px); align-items:end; flex:1; }
.ink-canvas-root .cp-hero-copy > .ink-el-container-inner,.ink-canvas-root .cp-proof-copy > .ink-el-container-inner { display:flex; flex-direction:column; align-items:flex-start; }
.ink-canvas-root .cp-section-head > .ink-el-container-inner { display:grid; grid-template-columns:1fr 1.4fr; column-gap:7vw; align-items:start; }
.ink-canvas-root .cp-project-grid > .ink-el-container-inner { display:grid; grid-template-columns:1.15fr .85fr; gap:18px; }
.ink-canvas-root .cp-project > .ink-el-container-inner { min-height:inherit; display:flex; flex-direction:column; }
.ink-canvas-root .cp-project:nth-child(3n) > .ink-el-container-inner { display:grid; grid-template-columns:1.1fr .9fr; }
.ink-canvas-root .cp-project-visual > .ink-el-container-inner { min-height:inherit; display:flex; flex-direction:row; justify-content:space-between; align-items:flex-end; }
.ink-canvas-root .cp-proof > .cp-shell > .ink-el-container-inner { display:grid; grid-template-columns:1.15fr .85fr; gap:clamp(50px,9vw,130px); align-items:start; }
.ink-canvas-root .cp-stats > .ink-el-container-inner { display:grid; }
.ink-canvas-root .cp-stat > .ink-el-container-inner { display:grid; grid-template-columns:.65fr 1fr; gap:24px; align-items:baseline; }
.ink-canvas-root .cp-steps > .ink-el-container-inner { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); }
.ink-canvas-root .cp-closing .cp-shell > .ink-el-container-inner { min-height:inherit; display:flex; flex-direction:column; justify-content:center; align-items:flex-start; }
.ink-canvas-root .cp-footer > .ink-el-container-inner { display:flex; flex-direction:row; justify-content:space-between; gap:24px; }
@media (max-width:800px) { .ink-canvas-root .cp-shell{width:min(100% - 32px,1180px);padding:72px 0}.ink-canvas-root .cp-nav{padding-bottom:72px}.ink-canvas-root .cp-nav-actions .cp-link-button:first-child{display:none}.ink-canvas-root .cp-hero-grid > .ink-el-container-inner,.ink-canvas-root .cp-proof > .cp-shell > .ink-el-container-inner,.ink-canvas-root .cp-section-head > .ink-el-container-inner{grid-template-columns:1fr}.ink-canvas-root .cp-hero-grid > .ink-el-container-inner{align-items:start}.ink-canvas-root .cp-hero-aside{margin-top:28px}.ink-canvas-root .cp-section-head .cp-kicker{grid-row:auto}.ink-canvas-root .cp-project-grid > .ink-el-container-inner{grid-template-columns:1fr}.ink-canvas-root .cp-project:nth-child(3n) > .ink-el-container-inner{grid-column:auto;display:flex;flex-direction:column}.ink-canvas-root .cp-project{min-height:0}.ink-canvas-root .cp-project-visual{min-height:260px}.ink-canvas-root .cp-steps > .ink-el-container-inner{grid-template-columns:1fr}.ink-canvas-root .cp-step,.ink-canvas-root .cp-step + .cp-step{padding:28px 0;border-right:0;border-bottom:1px solid color-mix(in srgb,var(--cp-bg) 20%,transparent)}.ink-canvas-root .cp-step-title{margin:24px 0 12px}.ink-canvas-root .cp-footer > .ink-el-container-inner{flex-direction:column}.ink-canvas-root .cp-display{font-size:clamp(50px,15vw,78px)} }
@media (prefers-reduced-motion:no-preference) { .ink-canvas-root .cp-project { transition:transform .45s cubic-bezier(.2,.8,.2,1),box-shadow .45s ease; }.ink-canvas-root .cp-project:hover { transform:translateY(-6px); box-shadow:0 24px 70px color-mix(in srgb,var(--cp-ink) 14%,transparent); }.ink-canvas-root [data-ink-reveal="pending"]{opacity:0;transform:translateY(22px)}.ink-canvas-root [data-ink-reveal="visible"]{opacity:1;transform:none;transition:opacity .7s cubic-bezier(.2,.8,.2,1) var(--ink-reveal-delay,0ms),transform .7s cubic-bezier(.2,.8,.2,1) var(--ink-reveal-delay,0ms)} }
`.trim();
        const customJs = `
(() => {
  const previous = window.__inkCustomCodeCleanup;
  if (typeof previous === 'function') previous();
  const items = [...document.querySelectorAll('.cp-section .cp-kicker, .cp-project, .cp-stat, .cp-step, .cp-testimonial')];
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    items.forEach((item) => item.dataset.inkReveal = 'visible');
    window.__inkCustomCodeCleanup = () => {};
    return;
  }
  items.forEach((item, index) => {
    item.dataset.inkReveal = 'pending';
    item.style.setProperty('--ink-reveal-delay', String((index % 4) * 65) + 'ms');
  });
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.dataset.inkReveal = 'visible';
    observer.unobserve(entry.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: .12 });
  items.forEach((item) => observer.observe(item));
  window.__inkCustomCodeCleanup = () => observer.disconnect();
})();`;
        return replacePage({
            settings: { backgroundColor: palette.background },
            children: [heroSection, workSection, proofSection, processSection, ...optionalFaq, closingSection],
            customCss,
            customJs,
        });
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
        const emptyContainers = allNodes.filter((node) => runtime.elements.get(node.type).acceptsChildren && !(node.children || []).length).length;
        const sectionLike = allNodes.filter((node) => ['section', 'container'].includes(node.type)).length;
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
        let score = 100;
        issues.forEach((issue) => { score -= issue.severity === 'error' ? 20 : 8; });
        return {
            score: Math.max(0, score),
            summary: { nodes: allNodes.length, roots: roots.length, sections: sectionLike, h1s, actions, emptyContainers, collapsedHeadings: collapsedHeadings.length, narrowContentColumns: narrowContent.length, customCssCharacters: builder.customCode.getCss().length, customJsCharacters: builder.customCode.getJs().length },
            issues,
            instruction: issues.length ? 'Fix the errors first, then warnings, and run audit_design again.' : 'The structural and rendered checks pass. Finish with a concise user-facing summary.',
        };
    };

    const apply = (name, args = {}) => {
        try {
            const target = resolve(args.path || args.id);
            switch (name) {
                case 'get_capabilities': return asJson(capabilities());
                case 'read_design': return index();
                case 'read_element': return target ? asJson({ settings: target.node.settings, styles: target.node.styles }) : 'element not found';
                case 'read_custom_code': return asJson({ css: builder.customCode.getCss(), js: builder.customCode.getJs() });
                case 'audit_design': return asJson(auditDesign());
                case 'compose_landing_page': return asJson(composeLandingPage(args));
                case 'replace_page': return asJson(replacePage(args));
                case 'append_tree': return asJson(appendTree(args));
                case 'insert_element': {
                    if (!runtime.elements.has(args.type)) return `unknown element type: ${args.type}`;
                    if (target && !runtime.elements.get(target.node.type).acceptsChildren) return 'target cannot contain children';
                    const node = runtime.insert(args.type, { parentId: target?.node.id || null, index: target ? (target.node.children?.length || 0) : runtime.document.data.children.length }, { settings: args.settings, styles: args.styles });
                    runtime.selection.select(node.id);
                    return asJson({ ok: true, id: node.id, type: node.type });
                }
                case 'update_element':
                    if (!target) return 'element not found';
                    runtime.update(target.node.id, { settings: args.settings || {} }, 'AI edit element'); return 'ok';
                case 'set_styles':
                    if (!target) return 'element not found';
                    runtime.update(target.node.id, { styles: args.styles || {} }, 'AI set styles'); return 'ok';
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
                case 'undo': runtime.history.undo(); return 'ok';
                case 'redo': runtime.history.redo(); return 'ok';
                default: return `unknown tool: ${name}`;
            }
        } catch (error) {
            return asJson({ ok: false, error: error.message });
        }
    };

    const treeNodeSchema = { type: 'object', description: 'Recursive builder node: {type, settings, styles, children}. Use only element types returned by get_capabilities.' };
    const TOOLS = [
        { name: 'get_capabilities', description: 'Return every available builder element grouped by category, its editable setting names/defaults, the responsive style shape, and custom-code support. Call this before composing a page.', parameters: { type: 'object', properties: {} } },
        { name: 'read_design', description: 'Return the current page as a numbered tree. Call before a targeted edit.', parameters: { type: 'object', properties: {} } },
        { name: 'read_element', description: 'Return one element settings and responsive styles.', parameters: { type: 'object', properties: { path: { type: 'string' }, id: { type: 'string' } } } },
        { name: 'read_custom_code', description: 'Return current page-level CSS and JavaScript.', parameters: { type: 'object', properties: {} } },
        { name: 'audit_design', description: 'Inspect the live rendered canvas for hierarchy, calls to action, empty containers, tiny text, horizontal overflow, and custom-code usage. Run after composing and after final corrections.', parameters: { type: 'object', properties: {} } },
        { name: 'compose_landing_page', description: 'Preferred whole-page tool. Compose an art-directed, responsive, fully editable landing page from a compact creative blueprint. Supply specific copy; the browser expands it into native builder primitives, polished responsive CSS, and one atomic undo step.', parameters: { type: 'object', properties: {
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
        { name: 'replace_page', description: 'Low-level escape hatch: atomically replace a page with a complete recursive element tree and optional custom CSS/JS. Use for non-standard compositions that the compact landing-page tool cannot express.', parameters: { type: 'object', properties: { settings: { type: 'object' }, children: { type: 'array', items: treeNodeSchema }, customCss: { type: 'string' }, customJs: { type: 'string' } }, required: ['children'] } },
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
        { name: 'undo', description: 'Undo the last builder or Copilot change.', parameters: { type: 'object', properties: {} } },
        { name: 'redo', description: 'Redo the last undone change.', parameters: { type: 'object', properties: {} } },
    ];

    const MUTATING_TOOLS = new Set(['compose_landing_page', 'replace_page', 'append_tree', 'insert_element', 'update_element', 'set_styles', 'move_element', 'remove_element', 'duplicate_element', 'set_custom_css', 'set_custom_js', 'css_edit', 'undo', 'redo']);
    return { apply, index, resolve, TOOLS, MUTATING_TOOLS, isMutation: (name) => MUTATING_TOOLS.has(name) };
}
