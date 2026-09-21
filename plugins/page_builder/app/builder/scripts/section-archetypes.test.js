"use strict";

// The archetypes are only useful if they emit *real* builder elements: types the registry knows and
// settings those types declare. This suite checks the emitted specs against the registry source
// itself, so an archetype cannot invent an element type or a misspelled setting.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ARCHETYPE_NAMES, archetype, buildSection, composePage, listArchetypes, PRICING_CSS } = require("./section-archetypes");
const { DEFAULT_TOKENS, designCss } = require("./design-tokens");

const CORE = path.join(__dirname, "../src/core");
const REGISTRY_FILES = ["inkElements.js", "inkFoundationElements.js", "inkMagicElements.js", "inkShaderElement.js"];
const registrySource = REGISTRY_FILES.map((file) => fs.readFileSync(path.join(CORE, file), "utf8")).join("\n");

// `register({ type: 'x', ...` / `register(registry, { type: 'x', ...`
const registeredTypes = new Set([...registrySource.matchAll(/register\(\s*(?:registry,\s*)?\{[\s\S]{0,80}?type:\s*'([a-z0-9-]+)'/g)].map((match) => match[1]));

// Default settings keys declared for a type, read straight from its `defaults: { settings: { ... } }`.
const declaredSettings = (type) => {
    const block = new RegExp(`type: '${type}',[\\s\\S]{0,1200}?defaults:\\s*\\{\\s*settings:\\s*\\{([^}]*)\\}`);
    const match = registrySource.match(block);
    if (!match) return null;
    return new Set([...match[1].matchAll(/(?:^|,)\s*(?:'([^']+)'|"([^"]+)"|([a-zA-Z][\w-]*))\s*:/g)].map((entry) => entry[1] || entry[2] || entry[3]));
};

// Settings every element accepts: identity, class hooks, and the universal behaviour contracts.
const UNIVERSAL = new Set([
    'label', 'cssClasses', 'cssId', 'role', 'tag', 'layout', 'interactions', 'stateNames', 'state', 'stateGroup',
    'motion', 'motionGroup', 'sticky', 'hidden', 'locked', 'condition',
]);

const walk = (spec, visit) => { visit(spec); (spec.children || []).forEach((child) => walk(child, visit)); };
const countNodes = (spec) => 1 + (spec.children || []).reduce((sum, child) => sum + countNodes(child), 0);

const EXPECTED = ['nav', 'hero', 'logos', 'features', 'stats', 'gallery', 'testimonials', 'pricing', 'faq', 'team', 'blogList', 'blogPost', 'profile', 'cta', 'contact', 'footer'];

test("every archetype declares a label, category, variants and a build function", () => {
    assert.deepEqual(ARCHETYPE_NAMES.sort(), [...EXPECTED].sort());
    for (const entry of listArchetypes()) {
        assert.ok(entry.label && entry.category && entry.description, `${entry.name} needs copy`);
        assert.ok(Array.isArray(entry.variants) && entry.variants.length, `${entry.name} needs at least one variant`);
    }
    assert.equal(archetype('HERO').label, 'Hero', 'names are matched case-insensitively for models');
    assert.equal(archetype('nope'), null);
    assert.throws(() => buildSection('nope'), /Unknown archetype/);
});

test("every archetype and variant emits only registered element types and declared settings", () => {
    const seen = new Set();
    for (const name of ARCHETYPE_NAMES) {
        for (const variant of archetype(name).variants) {
            const { spec, variant: resolved } = buildSection(name, { variant, tokens: DEFAULT_TOKENS, uid: `ink-arch-test-${name}` });
            assert.equal(resolved, variant);
            walk(spec, (node) => {
                assert.ok(registeredTypes.has(node.type), `${name}/${variant} uses unregistered type "${node.type}"`);
                seen.add(node.type);
                const declared = declaredSettings(node.type);
                for (const key of Object.keys(node.settings || {})) {
                    if (UNIVERSAL.has(key)) continue;
                    assert.ok(declared && declared.has(key), `${name}/${variant} sets "${key}" on ${node.type}, which does not declare it (declared: ${declared ? [...declared].join(', ') : 'unknown'})`);
                }
            });
            // Every class an archetype emits must exist in the design system stylesheet. The
            // per-instance hook (`ink-arch-<uid>`) is deliberately excluded: it is the handle an
            // interaction targets, not a design class.
            const instance = `ink-arch-test-${name}`;
            const css = designCss(DEFAULT_TOKENS);
            walk(spec, (node) => String(node.settings?.cssClasses || '').split(/\s+/).filter(Boolean)
                .filter((className) => className.startsWith('ink-arch-'))
                .filter((className) => className !== instance && !className.endsWith(`-${instance}`))
                .forEach((className) => {
                    assert.ok(css.includes(`.${className}`), `${name}/${variant} emits class "${className}" that the design system does not define`);
                }));
        }
    }
    assert.ok(seen.size >= 12, `archetypes should exercise a broad element vocabulary, saw ${seen.size}`);
});

test("a composed page is one editable tree styled by tokens, within the composition limit", () => {
    const page = composePage(['nav', 'hero', 'features', 'stats', 'testimonials', 'pricing', 'faq', 'team', 'blogList', 'cta', 'footer'], { tokens: DEFAULT_TOKENS });
    assert.equal(page.children.length, 11);
    assert.deepEqual(page.children.map((child) => child.settings.role), ['nav', 'hero', 'features', 'content', 'testimonials', 'pricing', 'faq', 'content', 'blog', 'cta', 'footer']);
    const total = page.children.reduce((sum, child) => sum + countNodes(child), 0);
    assert.ok(total < 400, `a full page must fit the composition limit, got ${total}`);
    assert.match(page.css, /^:root\{--ink-t-bg:/, 'the page carries its token variables');
    assert.match(page.css, /\.ink-arch-price-yearly/);
    assert.equal(composePage([], {}).children.length, 5, 'an empty request gets a sensible default page');
    // Bare names, objects, and per-section content overrides all work.
    const custom = composePage(['hero', { name: 'features', variant: 'bento', content: { features: [{ title: 'Only', body: 'One card.' }] } }], { content: { title: 'Overridden' } });
    assert.equal(custom.children.length, 2);
    assert.match(JSON.stringify(custom.children[0]), /Overridden/);
});

test("a pricing switch is real component state with a working interaction, not a styled box", () => {
    const { spec } = buildSection('pricing', { uid: 'ink-arch-9' });
    let root = null;
    walk(spec, (node) => { if (node.settings?.stateNames) root = node; });
    assert.ok(root, 'the pricing section must declare component states');
    assert.deepEqual(root.settings.stateNames, ['monthly', 'yearly']);
    assert.equal(root.settings.state, 'monthly');
    assert.match(root.settings.cssClasses, /ink-arch-pricing-ink-arch-9/);
    const buttons = [];
    walk(spec, (node) => { if (Array.isArray(node.settings?.interactions) && node.settings.interactions.length) buttons.push(node); });
    assert.equal(buttons.length, 2, 'both options set the state');
    for (const button of buttons) {
        const [action] = button.settings.interactions;
        assert.equal(action.action, 'setState');
        assert.equal(action.target, 'query');
        assert.equal(action.selector, '.ink-arch-pricing-ink-arch-9', 'the switch targets its own container');
    }
    assert.deepEqual(buttons.map((button) => button.settings.interactions[0].state), ['monthly', 'yearly']);
    assert.match(PRICING_CSS, /\[data-ink-state="yearly"\] \.ink-arch-price-monthly\{display:none!important\}/);
});

test("a team orbit is a motion group whose cards close the cycle", () => {
    const { spec } = buildSection('team', { variant: 'orbit', uid: 'ink-arch-3' });
    let deck = null;
    walk(spec, (node) => { if (node.settings?.motionGroup) deck = node; });
    assert.ok(deck, 'the orbit deck owns the timeline');
    assert.equal(deck.settings.motionGroup.kind, 'orbit3d');
    assert.equal(deck.settings.motionGroup.count, 6);
    for (const card of deck.children) {
        const motion = card.settings.motion;
        assert.equal(motion.trigger, 'load');
        assert.equal(motion.iterations, 'infinite');
        assert.ok(motion.keyframes.length >= 6);
        assert.equal(motion.keyframes[0].transform, motion.keyframes[motion.keyframes.length - 1].transform, 'the cycle must close');
    }
});

test("content overrides reach the emitted copy without inventing elements", () => {
    const { spec } = buildSection('hero', { variant: 'split', content: { eyebrow: 'New', title: 'A specific promise', lede: 'A specific explanation.', cta: { label: 'Go', url: '/go' } } });
    const json = JSON.stringify(spec);
    assert.match(json, /A specific promise/);
    assert.match(json, /A specific explanation\./);
    assert.match(json, /"url":"\/go"/);
    assert.ok(!json.includes('undefined'), 'no undefined copy leaks into a composed page');
    const { spec: faq } = buildSection('faq', { content: { faq: [{ question: 'Q one', answer: 'A one that is long enough to be a real answer.' }] } });
    assert.match(JSON.stringify(faq), /Q one/);
});
