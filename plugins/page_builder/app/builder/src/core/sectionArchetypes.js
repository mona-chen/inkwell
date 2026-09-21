// Named section archetypes: the AI's ceiling made explicit.
//
// Before this, the Copilot could compose exactly one page -- a single hardcoded aesthetic with its
// own `cp-*` stylesheet. That is a ceiling the model cannot exceed, because the *builder* had only
// one look. An archetype fixes that at the source: it is a named, parameterized section built from
// real element types, styled only through design tokens. A human picks the same archetype in the
// panel; the Copilot just fills it in.
//
// Every archetype is a pure function `build(variant, options) -> element spec`. Nothing here is
// model-only: the specs it returns are ordinary elements with real settings, so the composed page
// is 100% editable with the raw builder.

import { COMPONENT_CSS, DEFAULT_TOKENS, designCss, normalizeTokens } from './designTokens.js';

const node = (type, settings = {}, children = []) => ({ type, settings, ...(children.length ? { children } : {}) });
const heading = (text, tag = 'h2', className = 'ink-arch-title') => node('heading', { text: text || '', tag, cssClasses: className });
const paragraph = (text, className = 'ink-arch-body') => node('paragraph', { text: text || '', cssClasses: className });
const eyebrow = (text) => node('paragraph', { text: text || '', cssClasses: 'ink-arch-eyebrow' });
const button = (label, url, className = 'ink-arch-button') => node('button', { text: label || 'Learn more', url: url || '#', cssClasses: className });
const image = (src, alt, className = 'ink-arch-media') => node('image', { src: src || '', alt: alt || '', cssClasses: className });
const container = (className, children, tag = 'div') => node('container', { tag, layout: 'full', cssClasses: className }, children);
const card = (children, extra = '') => container(`ink-arch-card${extra ? ` ${extra}` : ''}`, children);

const list = (value, fallback) => (Array.isArray(value) && value.length ? value : fallback);
const text = (value, fallback = '') => (value == null ? fallback : String(value));

const DEFAULT_CONTENT = {
    eyebrow: 'Product',
    title: 'A calmer way through complex work',
    lede: 'Turn a fragmented workflow into one confident path — legible, fast, and built to scale with the team.',
    cta: { label: 'Start free', url: '#start' },
    secondary: { label: 'Book a walkthrough', url: '#demo' },
    nav: { brand: 'Inkwell', links: [{ text: 'Product', url: '#product' }, { text: 'Pricing', url: '#pricing' }, { text: 'Blog', url: '/posts' }], cta: { label: 'Get started', url: '#start' } },
    features: [
        { title: 'One source of truth', body: 'Every change lands where the team already looks, so nobody re-checks a stale copy.' },
        { title: 'Built for handover', body: 'Work moves between people without losing the reasoning behind it.' },
        { title: 'Legible by default', body: 'Dense information stays readable at the speed decisions actually happen.' },
    ],
    stats: [{ number: '4.2', suffix: 'x', title: 'Faster handover' }, { number: '98', suffix: '%', title: 'On-time delivery' }, { number: '12', suffix: 'k', title: 'Teams onboarded' }],
    plans: [
        { name: 'Starter', monthly: '$0', yearly: '$0', note: 'For trying the workflow end to end.', features: ['3 projects', 'Community support', 'Core templates'], cta: { label: 'Start free', url: '#start' } },
        { name: 'Team', monthly: '$29', yearly: '$23', note: 'For teams who ship together.', features: ['Unlimited projects', 'Priority support', 'Shared libraries', 'Review flows'], cta: { label: 'Choose Team', url: '#start' }, featured: true },
        { name: 'Scale', monthly: '$89', yearly: '$71', note: 'For organisations with governance needs.', features: ['SSO and audit log', 'Dedicated success', 'Custom roles'], cta: { label: 'Talk to sales', url: '#contact' } },
    ],
    faq: [
        { question: 'How long does setup take?', answer: 'Most teams are running their first project the same afternoon. Bring one real workflow and we will wire it with you.' },
        { question: 'Can we keep our existing content?', answer: 'Yes. Import an existing site or paste content in, and everything arrives as editable structure rather than a frozen page.' },
        { question: 'What happens at the end of the trial?', answer: 'Nothing breaks. Your drafts stay editable and you choose a plan when you are ready to publish.' },
    ],
    testimonials: [
        { quote: 'We replaced three tools and a standing meeting with one board everyone actually reads.', name: 'Alex Morgan', role: 'Head of Operations' },
        { quote: 'The first week paid for the year. Handover stopped being a project of its own.', name: 'Priya Raman', role: 'Delivery Lead' },
    ],
    team: [
        { name: 'Ada Lovelace', role: 'Founder', src: '' },
        { name: 'Grace Hopper', role: 'Engineering', src: '' },
        { name: 'Katherine Johnson', role: 'Research', src: '' },
        { name: 'Margaret Hamilton', role: 'Platform', src: '' },
    ],
    gallery: [
        { src: '', alt: 'Product overview' }, { src: '', alt: 'Workspace detail' }, { src: '', alt: 'Team planning' },
    ],
    links: [
        { title: 'Product', items: [{ text: 'Overview', url: '#product' }, { text: 'Pricing', url: '#pricing' }, { text: 'Changelog', url: '/changelog' }] },
        { title: 'Company', items: [{ text: 'About', url: '/about' }, { text: 'Blog', url: '/posts' }, { text: 'Contact', url: '/contact' }] },
    ],
};

function withDefaults(options = {}) {
    const content = { ...DEFAULT_CONTENT, ...(options.content || {}) };
    return {
        ...options,
        uid: String(options.uid || 'ink-arch-1').replace(/[^a-zA-Z0-9_-]/g, '') || 'ink-arch-1',
        tokens: normalizeTokens(options.tokens),
        content,
    };
}

// camelCase archetype names become kebab-case class hooks (`blogList` -> `ink-arch-blog-list`) so
// every emitted class is a CSS selector a human can target, and `ink-arch-<uid>` stays the
// per-instance handle interactions point at.
export const sectionClass = (name) => `ink-arch-${String(name).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;

function sectionShell(name, children, options, extraClass = '') {
    return node('section', {
        tag: 'section', layout: 'full',
        role: options.role || name,
        cssClasses: `ink-arch-section ${sectionClass(name)} ${options.uid}${extraClass ? ` ${extraClass}` : ''}`,
    }, [container('ink-arch-shell', children)]);
}

// --- archetypes -----------------------------------------------------------------------------------

const ARCHETYPES = {
    nav: {
        label: 'Navigation', category: 'Chrome', role: 'nav',
        description: 'Brand, primary links and one action, in a sticky-capable bar.',
        variants: ['inline'],
        build: (options) => {
            const { nav } = options.content;
            const links = list(nav.links, DEFAULT_CONTENT.nav.links).map((entry) => node('link', { text: text(entry.text), url: text(entry.url, '#'), cssClasses: 'ink-arch-nav-link' }));
            return node('container', {
                tag: 'nav', layout: 'full', role: 'nav', label: 'Global nav',
                cssClasses: `ink-arch-nav ${options.uid}`,
                ...(options.sticky ? { sticky: { enabled: true, top: 0, zIndex: 50 } } : {}),
            }, [container('ink-arch-shell ink-arch-row', [
                heading(text(nav.brand, 'Inkwell'), 'div', 'ink-arch-subtitle'),
                container('ink-arch-nav-links', links),
                button(nav.cta?.label, nav.cta?.url),
            ])]);
        },
    },
    hero: {
        label: 'Hero', category: 'Opening', role: 'hero',
        description: 'The first screen: positioning line, supporting copy and actions.',
        variants: ['split', 'centered', 'display'],
        build: (options) => {
            const { content } = options;
            const copy = [
                eyebrow(content.eyebrow),
                heading(content.title, 'h1', 'ink-arch-display'),
                paragraph(content.lede, 'ink-arch-lede'),
                container('ink-arch-row', [button(content.cta?.label, content.cta?.url), button(content.secondary?.label, content.secondary?.url, 'ink-arch-button ink-arch-button--ghost')]),
            ];
            if (options.variant === 'centered') return sectionShell('hero', [container('ink-arch-stack', copy)], { ...options, role: 'hero' });
            if (options.variant === 'display') return sectionShell('hero', [...copy, image(options.media?.src, options.media?.alt, 'ink-arch-media ink-arch-media--wide')], { ...options, role: 'hero' });
            return sectionShell('hero', [container('ink-arch-split', [
                container('ink-arch-stack', copy),
                image(options.media?.src, options.media?.alt, 'ink-arch-media ink-arch-media--portrait'),
            ])], { ...options, role: 'hero' });
        },
    },
    logos: {
        label: 'Logo row', category: 'Social proof', role: 'content',
        description: 'A quiet row of customer or integration names.',
        variants: ['marquee', 'row'],
        build: (options) => {
            const names = list(options.content.logos, ['Northwind', 'Contoso', 'Fabrikam', 'Globex', 'Initech']).map((name) => text(name));
            if (options.variant === 'marquee') {
                return sectionShell('logos', [node('marquee', { items: names.map((name) => ({ name, body: '' })), duration: 32, pauseOnHover: true })], options);
            }
            return sectionShell('logos', [container('ink-arch-row', names.map((name) => heading(name, 'div', 'ink-arch-eyebrow')))], options);
        },
    },
    features: {
        label: 'Features', category: 'Value', role: 'features',
        description: 'Three to four proof points as cards, a tight grid, or a bento layout.',
        variants: ['cards', 'grid', 'bento'],
        build: (options) => {
            const items = list(options.content.features, DEFAULT_CONTENT.features);
            const body = [eyebrow(options.content.eyebrow), heading(options.content.featureTitle || 'Built for the work you actually do'), paragraph(options.content.featureLede || options.content.lede, 'ink-arch-lede')];
            if (options.variant === 'bento') {
                return sectionShell('features', [...body, node('bento-grid', { features: items.map((item, index) => ({ name: text(item.title), description: text(item.body), icon: text(item.icon, 'auto_awesome'), visual: 'files', span: index % 3 === 1 ? 'is-wide' : 'is-narrow', cta: '' })) })], options);
            }
            const grid = container(options.variant === 'grid' ? 'ink-arch-grid ink-arch-grid--4' : 'ink-arch-grid', items.map((item) => card([heading(text(item.title), 'h3', 'ink-arch-subtitle'), paragraph(text(item.body))])));
            return sectionShell('features', [...body, grid], options);
        },
    },
    stats: {
        label: 'Stats', category: 'Value', role: 'content',
        description: 'A row of numbers that proves the claim.',
        variants: ['row'],
        build: (options) => sectionShell('stats', [container('ink-arch-grid ink-arch-grid--4', list(options.content.stats, DEFAULT_CONTENT.stats).map((stat) => card([
            node('counter', { number: text(stat.number), suffix: text(stat.suffix), title: '', cssClasses: 'ink-arch-stat' }),
            paragraph(text(stat.title), 'ink-arch-body'),
        ], 'ink-arch-card--plain')))], options),
    },
    gallery: {
        label: 'Gallery', category: 'Media', role: 'content',
        description: 'A grid of images with consistent aspect ratios.',
        variants: ['grid', 'wide'],
        build: (options) => sectionShell('gallery', [container('ink-arch-grid', list(options.content.gallery, DEFAULT_CONTENT.gallery).map((item) => image(item.src, item.alt, `ink-arch-media${options.variant === 'wide' ? ' ink-arch-media--wide' : ''}`)))], options),
    },
    testimonials: {
        label: 'Testimonials', category: 'Social proof', role: 'testimonials',
        description: 'Customer quotes from the people who signed off.',
        variants: ['cards'],
        build: (options) => sectionShell('testimonials', [
            eyebrow('Customers'), heading(options.content.testimonialTitle || 'Teams stop chasing status'),
            container('ink-arch-grid ink-arch-grid--2', list(options.content.testimonials, DEFAULT_CONTENT.testimonials).map((entry) => node('testimonial', {
                quote: text(entry.quote), name: text(entry.name), role: text(entry.role), avatar: text(entry.avatar),
                cssClasses: 'ink-arch-card',
            }))),
        ], options),
    },
    pricing: {
        label: 'Pricing', category: 'Commercial', role: 'pricing',
        description: 'Tiers with a working monthly/yearly switch — real component states and a toggle interaction, not a styled box.',
        variants: ['switch', 'tiers'],
        build: (options) => {
            const plans = list(options.content.plans, DEFAULT_CONTENT.plans);
            const switchable = options.variant !== 'tiers';
            const selector = `.ink-arch-pricing-${options.uid}`;
            const columns = plans.map((plan) => card([
                heading(text(plan.name), 'h3', 'ink-arch-subtitle'),
                node('paragraph', { text: text(plan.monthly), cssClasses: 'ink-arch-price ink-arch-price-monthly' }),
                ...(switchable ? [node('paragraph', { text: text(plan.yearly), cssClasses: 'ink-arch-price ink-arch-price-yearly' })] : []),
                paragraph(text(plan.note), 'ink-arch-body'),
                node('icon-list', { items: list(plan.features, []).map((feature) => ({ icon: 'check', text: text(feature), url: '' })) }),
                button(plan.cta?.label, plan.cta?.url, plan.featured ? 'ink-arch-button' : 'ink-arch-button ink-arch-button--ghost'),
            ]));
            const heading1 = [eyebrow('Pricing'), heading(options.content.pricingTitle || 'Simple, honest pricing')];
            if (!switchable) return sectionShell('pricing', [...heading1, container('ink-arch-grid', columns)], options);
            // Each option sets the container's state; the archetype CSS swaps which price line shows,
            // so the switch works in Design, Preview and published output with no script.
            const optionsRow = container('ink-arch-row', ['monthly', 'yearly'].map((state) => node('button', {
                text: state === 'monthly' ? 'Monthly' : 'Yearly', url: '#',
                cssClasses: 'ink-arch-button ink-arch-button--ghost',
                interactions: [{ on: 'click', action: 'setState', target: 'query', selector, state }],
            })));
            const pricingRoot = container(`ink-arch-stack ink-arch-pricing-${options.uid}`, [container('ink-arch-grid', columns)], 'div');
            pricingRoot.settings.stateNames = ['monthly', 'yearly'];
            pricingRoot.settings.state = 'monthly';
            pricingRoot.settings.stateGroup = options.uid;
            return sectionShell('pricing', [...heading1, optionsRow, pricingRoot], options);
        },
    },
    faq: {
        label: 'FAQ', category: 'Support', role: 'faq',
        description: 'Questions that open in place, as a native accordion.',
        variants: ['accordion'],
        build: (options) => sectionShell('faq', [
            eyebrow('Answers'), heading(options.content.faqTitle || 'Questions we get asked'),
            node('timeline-accordion', { behavior: 'single', cssClasses: 'ink-arch-faq' }, list(options.content.faq, DEFAULT_CONTENT.faq).map((entry) => node('container', { tag: 'div', layout: 'full', cssClasses: 'ink-arch-faq-item' }, [
                heading(text(entry.question), 'h3', 'ink-arch-subtitle'),
                paragraph(text(entry.answer)),
            ]))),
        ], options),
    },
    team: {
        label: 'Team', category: 'People', role: 'content',
        description: 'Portraits that can orbit in 3D — a motion group driving every card off one timeline.',
        variants: ['grid', 'orbit'],
        build: (options) => {
            const people = list(options.content.team, DEFAULT_CONTENT.team);
            const cards = people.map((person) => card([
                image(person.src, `${text(person.name)} portrait`, 'ink-arch-media ink-arch-media--portrait'),
                heading(text(person.name), 'h3', 'ink-arch-subtitle'),
                paragraph(text(person.role), 'ink-arch-body'),
            ], 'ink-arch-card--plain'));
            if (options.variant !== 'orbit') return sectionShell('team', [eyebrow('Team'), heading(options.content.teamTitle || 'The people behind it'), container(`ink-arch-grid ink-arch-grid--4 ink-arch-orbit-${options.uid}`, cards)], options);
            // A 3D orbit is a motion group: the container owns the timeline, each card carries the
            // pose cycle. Same data the importer reconstructs from a captured site.
            const poses = [
                { rotateY: 0, translateZ: 0 },
                { rotateY: 60, translateZ: -220 },
                { rotateY: 120, translateZ: -360 },
                { rotateY: 180, translateZ: -220 },
                { rotateY: 240, translateZ: -360 },
                { rotateY: 300, translateZ: -220 },
            ];
            const deck = cards.map((cardSpec, index) => {
                const keyframes = poses.map((pose, step) => ({
                    offset: Math.round((step / poses.length) * 10000) / 10000,
                    transform: `translateZ(${pose.translateZ}px) rotateY(${(pose.rotateY + index * 0) % 360}deg)`,
                }));
                const closing = { offset: 1, transform: `translateZ(${poses[0].translateZ}px) rotateY(${poses[0].rotateY}deg)` };
                cardSpec.settings.motion = { enabled: true, trigger: 'load', duration: 9000, delay: index * 120, easing: 'linear', iterations: 'infinite', direction: 'normal', keyframes: [...keyframes, closing] };
                cardSpec.settings.label = cardSpec.settings.label || `Orbit card ${index + 1}`;
                return cardSpec;
            });
            const orbit = container('ink-arch-grid ink-arch-grid--4 ink-arch-orbit-deck', deck);
            orbit.settings.motionGroup = { kind: 'orbit3d', label: '3D orbit', perspective: 1200, count: poses.length };
            return sectionShell('team', [eyebrow('Team'), heading(options.content.teamTitle || 'The people behind it'), orbit], options);
        },
    },
    blogList: {
        label: 'Blog list', category: 'Content', role: 'blog',
        description: 'A live list bound to published posts — a query loop with an editable card template.',
        variants: ['grid', 'list'],
        build: (options) => sectionShell('blogList', [
            eyebrow('Writing'), heading(options.content.blogTitle || 'Notes from the team'),
            node('query-loop', { source: 'posts', limit: Number(options.content.blogLimit) || 6, cssClasses: `ink-arch-${options.variant === 'list' ? 'stack' : 'grid'}` }, [
                card([
                    image('', '{{ post.featured_image }}', 'ink-arch-media ink-arch-media--wide'),
                    heading('{{ post.title }}', 'h3', 'ink-arch-subtitle'),
                    paragraph('{{ post.excerpt }}'),
                    node('link', { text: 'Read more', url: '/posts/{{ post.slug }}', cssClasses: 'ink-arch-nav-link' }),
                ]),
            ]),
        ], options),
    },
    blogPost: {
        label: 'Blog post', category: 'Template', role: 'content',
        description: 'The single-post template: title, meta, then the authored blocks.',
        variants: ['article'],
        build: (options) => sectionShell('blogPost', [
            eyebrow('{{ post.published_at }}'),
            heading('{{ post.title }}', 'h1', 'ink-arch-display'),
            paragraph('{{ post.excerpt }}', 'ink-arch-lede'),
            node('post-content', { cssClasses: 'ink-arch-body' }),
        ], options),
    },
    profile: {
        label: 'Author profile', category: 'Template', role: 'content',
        description: 'An author card followed by their published posts.',
        variants: ['author'],
        build: (options) => sectionShell('profile', [
            container('ink-arch-split', [
                image('{{ author.avatar }}', '{{ author.name }}', 'ink-arch-media ink-arch-media--portrait'),
                container('ink-arch-stack', [
                    eyebrow('Author'), heading('{{ author.name }}', 'h1', 'ink-arch-display'),
                    paragraph('{{ author.bio }}', 'ink-arch-lede'),
                ]),
            ]),
            node('query-loop', { source: 'posts', limit: 6, cssClasses: 'ink-arch-grid' }, [
                card([heading('{{ post.title }}', 'h3', 'ink-arch-subtitle'), paragraph('{{ post.excerpt }}')]),
            ]),
        ], options),
    },
    cta: {
        label: 'Call to action', category: 'Closing', role: 'cta',
        description: 'The closing ask, on one confident line.',
        variants: ['banner'],
        build: (options) => sectionShell('cta', [container('ink-arch-stack', [
            heading(options.content.ctaTitle || 'Bring your next project here', 'h2', 'ink-arch-display'),
            paragraph(options.content.ctaLede || options.content.lede, 'ink-arch-lede'),
            container('ink-arch-row', [button(options.content.cta?.label, options.content.cta?.url), button(options.content.secondary?.label, options.content.secondary?.url, 'ink-arch-button ink-arch-button--ghost')]),
        ])], options),
    },
    contact: {
        label: 'Contact', category: 'Support', role: 'form',
        description: 'A short form that already works as a form, not a picture of one.',
        variants: ['form'],
        build: (options) => sectionShell('contact', [
            eyebrow('Contact'), heading(options.content.contactTitle || 'Tell us what you are building'),
            container('ink-arch-stack', [
                node('input', { inputType: 'text', name: 'name', placeholder: 'Your name' }),
                node('input', { inputType: 'email', name: 'email', placeholder: 'you@company.com' }),
                node('textarea', { name: 'message', placeholder: 'A sentence about the project' }),
                button(options.content.cta?.label || 'Send', options.content.cta?.url || '#contact'),
            ]),
        ], options),
    },
    footer: {
        label: 'Footer', category: 'Chrome', role: 'footer',
        description: 'Link columns and a legal line.',
        variants: ['columns'],
        build: (options) => node('container', {
            tag: 'footer', layout: 'full', role: 'footer', label: 'Global footer',
            cssClasses: `ink-arch-footer ${options.uid}`,
        }, [container('ink-arch-shell', [
            container('ink-arch-grid', list(options.content.links, DEFAULT_CONTENT.links).map((column) => container('ink-arch-stack', [
                heading(text(column.title), 'h3', 'ink-arch-eyebrow'),
                ...list(column.items, []).map((entry) => node('link', { text: text(entry.text), url: text(entry.url, '#'), cssClasses: 'ink-arch-nav-link' })),
            ]))),
            node('divider', { cssClasses: 'ink-arch-divider' }),
            paragraph(options.content.legal || `© ${new Date().getFullYear()} Inkwell. All rights reserved.`, 'ink-arch-body'),
        ])]),
    },
};

// Pricing needs state-driven visibility, which is CSS on the state attribute -- the same shape the
// importer emits for a captured pricing switch.
// Component behaviour (the price switch, the orbit deck) lives in the design system sheet itself.
const PRICING_CSS = COMPONENT_CSS;

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);

export function listArchetypes() {
    return ARCHETYPE_NAMES.map((name) => ({
        name, label: ARCHETYPES[name].label, category: ARCHETYPES[name].category,
        description: ARCHETYPES[name].description, variants: ARCHETYPES[name].variants,
        role: ARCHETYPES[name].role, sectionClass: sectionClass(name),
    }));
}

// Names are camelCase (`blogList`), so lookup is a lowercase index: a model writing "bloglist" or
// "BlogList" still resolves, and the canonical name is what gets reported back.
const ARCHETYPE_INDEX = new Map(Object.entries(ARCHETYPES).map(([key, definition]) => [key.toLowerCase(), { name: key, definition }]));

export function archetype(name) { return ARCHETYPE_INDEX.get(String(name || '').toLowerCase())?.definition || null; }
export function archetypeName(name) { return ARCHETYPE_INDEX.get(String(name || '').toLowerCase())?.name || null; }

export function buildSection(name, options = {}) {
    const definition = archetype(name);
    if (!definition) throw new TypeError(`Unknown archetype "${name}". Available: ${ARCHETYPE_NAMES.join(', ')}.`);
    const prepared = withDefaults(options);
    const variant = definition.variants.includes(prepared.variant) ? prepared.variant : definition.variants[0];
    const role = prepared.role || definition.role || prepared.uid;
    return { name: archetypeName(name), variant, role, spec: definition.build({ ...prepared, role, variant }) };
}

// Compose a whole page from archetype names. Deterministic ids keep interactions (a pricing switch
// targeting its own container) valid without any global counter.
export function composePage(names, options = {}) {
    const requested = Array.isArray(names) && names.length ? names : ['nav', 'hero', 'features', 'cta', 'footer'];
    const tokens = normalizeTokens(options.tokens || DEFAULT_TOKENS);
    const content = options.content || {};
    const children = requested.map((entry, index) => {
        const spec = typeof entry === 'string' ? { name: entry } : (entry || {});
        const built = buildSection(spec.name, {
            ...options, tokens, content: { ...content, ...(spec.content || {}) },
            variant: spec.variant, media: spec.media, sticky: spec.sticky,
            uid: `ink-arch-${index + 1}`,
        });
        const root = built.spec;
        // A composed page names each root by its archetype role, so Structure, the navigator and
        // the importer's quality report all agree on what a section is.
        root.settings = { ...(root.settings || {}), role: spec.role || built.role, label: spec.label || archetype(spec.name).label };
        return root;
    });
    return { children, css: designCss(tokens) };
}

export { PRICING_CSS, DEFAULT_CONTENT };
