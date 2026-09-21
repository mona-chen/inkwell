"use strict";

// Unit coverage for the importer's structure inference. Every fixture is synthetic: these tests
// assert that behaviour is derived from markup and geometry, never from a particular website.

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  inferPatterns, parsePose, poseFromMatrix, poseSignature, poseToTransform,
} = require("./site-patterns");

const container = (attrs = {}, children = [], settings = {}) => ({
  type: "container",
  settings: { importedDom: true, importedTag: "div", importedAttributes: attrs, ...settings },
  ...(children.length ? { children } : {}),
});
const textNode = (type, text, attrs = {}, settings = {}) => ({
  type,
  settings: { importedDom: true, importedTag: type === "heading" ? "h2" : "p", importedAttributes: attrs, text, ...settings },
});
const link = (text, href, attrs = {}) => ({
  type: "link",
  settings: { importedDom: true, importedTag: "a", importedAttributes: { href, ...attrs }, text },
});

// A control built the way hand-written sites build one: a radio group whose labels pair by `for`.
const radio = (id, name = "plan") => ({
  type: "input",
  settings: { importedDom: true, importedTag: "input", importedAttributes: { type: "radio", name, id } },
});
const optionLabel = (id, text) => ({
  type: "label",
  settings: { importedDom: true, importedTag: "label", importedAttributes: { for: id }, text },
});

const viewport = (nodes, extra = {}) => ({
  viewport: { width: 1440, height: 900 }, document: { width: 1440, height: 4000 }, nodes, ...extra,
});
const evidence = (attrs, rect, style = {}) => ({
  tag: attrs.tag || "div", id: attrs.id || null, classes: String(attrs.class || "").split(/\s+/).filter(Boolean),
  framerName: attrs["data-framer-name"] || null, rect,
  style: { display: "block", position: "relative", overflow: "visible", transform: "none", ...style },
  text: attrs.text || "", attributes: attrs,
});

test("reads a rotation column out of matrix3d without picking up digits from the function name", () => {
  const pose = poseFromMatrix("matrix3d(0.5, 0, 0.866025, 0, 0, 1, 0, 0, -0.866025, 0, 0.5, 0, 0, 0, -220, 1)");
  assert.equal(pose.rotateY, 60);
  assert.equal(pose.translateZ, -220);
  const flat = poseFromMatrix("matrix(1, 0, 0, 1, -181, -154)");
  assert.equal(flat.translateX, -181);
  assert.equal(flat.translateY, -154);
  assert.equal(poseFromMatrix("none"), null);
});

test("pose helpers round-trip into a transform string", () => {
  const pose = parsePose("translateZ(-220px) rotateY(-60deg)");
  assert.equal(pose.rotateY, -60);
  assert.equal(pose.translateZ, -220);
  assert.equal(poseToTransform({ ...pose, translateX: -107.5 }), "translate3d(-107.5px,0px,-220px) rotateY(-60deg)");
  assert.equal(poseSignature({ rotateX: 0, rotateY: 60, translateZ: -218 }), "0:60:-225");
});

test("an authored 3D card orbit becomes an editable motion group with measured poses", () => {
  const cards = [1, 2, 3, 4].map((label) => container(
    { class: `card-${label}`, "data-framer-name": String(label), style: `transform:${["translateZ(-220px) rotateY(-60deg)", "translateZ(-360px)", "translateZ(-220px) rotateY(60deg)", "translateZ(1px)"][label - 1]}` },
    [],
  ));
  const orbit = container({ class: "orbit", "data-framer-name": "Images", style: "transform:perspective(1200px)" }, cards);
  const nodes = [
    evidence({ class: "orbit", "data-framer-name": "Images" }, { x: 675, y: 0, width: 462, height: 284 }, { transform: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)" }),
    evidence({ class: "card-1", "data-framer-name": "1" }, { x: 799, y: 0, width: 214, height: 284 }, { transform: "none" }),
    evidence({ class: "card-2", "data-framer-name": "2" }, { x: 962, y: 0, width: 105, height: 257 }, { transform: "matrix3d(0.5,0,0.866025,0,0,1,0,0,-0.866025,0,0.5,0,0,0,-220,1)" }),
    evidence({ class: "card-3", "data-framer-name": "3" }, { x: 824, y: 0, width: 165, height: 218 }, { transform: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,-360,1)" }),
    evidence({ class: "card-4", "data-framer-name": "4" }, { x: 746, y: 0, width: 105, height: 257 }, { transform: "matrix3d(0.5,0,-0.866025,0,0,1,0,0,0.866025,0,0.5,0,0,0,-220,1)" }),
  ];
  const { report } = inferPatterns([orbit], { viewports: [viewport(nodes)] });
  assert.deepEqual(orbit.settings.motionGroup, { kind: "orbit3d", label: "3D orbit", perspective: 1200, count: 4 });
  assert.equal(report.counts.orbit3d, 1);
  // Each card carries the whole cycle, offset so the captured state is frame zero.
  const first = cards[0].settings.motion;
  assert.equal(first.trigger, "load");
  assert.equal(first.iterations, "infinite");
  assert.equal(first.keyframes.length, 5);
  assert.deepEqual(first.keyframes.map((frame) => frame.offset), [0, 0.25, 0.5, 0.75, 1]);
  assert.match(first.keyframes[0].transform, /translate3d\(-107\.5px,0px,-220px\) rotateY\(-60deg\)/);
  assert.match(first.keyframes[2].transform, /translate3d\(108\.5px,0px,-220px\) rotateY\(60deg\)/);
  assert.equal(cards[0].settings.motion.keyframes[4].transform, first.keyframes[0].transform, "the cycle must close");
  assert.equal(cards[1].settings.motion.keyframes[0].transform, first.keyframes[1].transform);
});

test("a navigation rebuilds the mobile panel the site renders from component code", () => {
  const nav = container({ class: "top-nav" }, [
    container({ class: "links" }, [link("Product", "/product"), link("Pricing", "/pricing")]),
    container({ class: "burger" }, [{ type: "svg", settings: { importedDom: true, importedTag: "svg", importedAttributes: {} } }]),
  ]);
  const nodes = [
    evidence({ class: "top-nav" }, { x: 0, y: 0, width: 1440, height: 80 }),
    evidence({ class: "links" }, { x: 0, y: 0, width: 400, height: 24 }),
    evidence({ class: "burger" }, { x: 1390, y: 20, width: 30, height: 30 }, { display: "block" }),
  ];
  const { report, css } = inferPatterns([nav], { viewports: [viewport(nodes)] });
  const panel = nav.children[nav.children.length - 1];
  assert.match(panel.settings.cssClasses, /ink-inferred-nav-panel-1/);
  assert.deepEqual(panel.settings.stateNames, ["closed", "open"]);
  assert.deepEqual(panel.children.map((child) => child.settings.text), ["Product", "Pricing"]);
  const burger = nav.children[1];
  assert.deepEqual(burger.settings.interactions, [{ on: "click", action: "toggleState", target: "query", selector: ".ink-inferred-nav-panel-1", state: "open" }]);
  assert.match(css, /@media\(max-width:991px\)/);
  assert.equal(report.components.filter((entry) => entry.kind === "nav").length, 1);
});

test("a monthly/yearly switch becomes component states with real setter interactions", () => {
  const options = [
    { type: "button", settings: { importedDom: true, importedTag: "button", importedAttributes: { class: "opt" }, text: "Monthly" } },
    { type: "button", settings: { importedDom: true, importedTag: "button", importedAttributes: { class: "opt" }, text: "Yearly" } },
  ];
  const pricing = container({ class: "plans" }, [
    container({ class: "switch" }, options),
    container({ class: "price" }, [textNode("paragraph", "$29 per month")]),
  ]);
  const { report } = inferPatterns([pricing], { viewports: [viewport([evidence({ class: "plans" }, { x: 0, y: 0, width: 1200, height: 600 })])] });
  assert.deepEqual(pricing.settings.stateNames, ["monthly", "yearly"]);
  assert.equal(pricing.settings.state, "monthly");
  assert.deepEqual(options[1].settings.interactions, [{ on: "click", action: "setState", target: "query", selector: ".ink-inferred-toggle-1", state: "yearly" }]);
  assert.equal(report.counts["pricing-switch"], 1);
});

test("repeated trigger/panel items become a native timeline accordion", () => {
  const items = [1, 2, 3, 4].map((index) => container({ class: "row" }, [
    container({ class: "question" }, [textNode("heading", `Question ${index}`)]),
    container({ class: "answer" }, [textNode("paragraph", `Long answer number ${index} that explains the point in detail.`)], { }),
  ]));
  const accordion = container({ class: "faq" }, items);
  const nodes = [evidence({ class: "faq" }, { x: 0, y: 0, width: 900, height: 400 })];
  items.forEach((item, index) => {
    nodes.push(evidence({ class: "row" }, { x: 0, y: index * 90, width: 900, height: 86 }));
    nodes.push(evidence({ class: "answer" }, { x: 0, y: index * 90, width: 900, height: 86 }, { overflow: "hidden", position: "absolute" }));
    nodes.push(evidence({ class: "question" }, { x: 0, y: index * 90, width: 800, height: 40 }));
  });
  const { report } = inferPatterns([accordion], { viewports: [viewport(nodes)] });
  assert.equal(accordion.type, "timeline-accordion");
  assert.equal(accordion.settings.behavior, "single");
  assert.match(items[0].children[0].settings.cssClasses, /ink-inferred-accordion-question/);
  assert.match(items[0].children[1].settings.cssClasses, /ink-inferred-accordion-content/);
  assert.equal(report.counts.accordion, 1);
});

test("a repeated card row is reported as one grid component", () => {
  const cards = [1, 2, 3, 4, 5, 6].map(() => container({ class: "card" }, [textNode("heading", "Card"), textNode("paragraph", "Body copy for the card.")]));
  const grid = container({ class: "cards" }, cards);
  const nodes = [evidence({ class: "cards" }, { x: 0, y: 0, width: 1200, height: 600 }, { display: "grid", gridTemplateColumns: "380px 380px 380px" })];
  cards.forEach((card, index) => nodes.push(evidence({ class: "card" }, { x: (index % 3) * 400, y: Math.floor(index / 3) * 300, width: 380, height: 280 })));
  const { report } = inferPatterns([grid], { viewports: [viewport(nodes)] });
  const component = report.components.find((entry) => entry.kind === "card-grid");
  assert.ok(component, "expected a card grid");
  assert.equal(component.count, 6);
  assert.equal(component.columns, 3);
  assert.equal(cards[0].settings.role, "card");
});

test("shared header and footer are defined once from structure, not from layer names", () => {
  const header = container({ class: "masthead" }, [container({ class: "nav" }, [link("Home", "/"), link("Blog", "/blog")])]);
  header.settings.importedTag = "header";
  const footer = container({ class: "legal" }, [
    container({ class: "columns" }, [
      container({ class: "col" }, [link("A", "/a"), link("B", "/b")]),
      container({ class: "col" }, [link("C", "/c"), link("D", "/d")]),
    ]),
    textNode("paragraph", "© 2026 Inkwell"),
  ]);
  const page = container({ class: "page" }, [header, footer]);
  const nodes = [
    evidence({ class: "masthead", tag: "header" }, { x: 0, y: 0, width: 1440, height: 90 }),
    evidence({ class: "nav" }, { x: 0, y: 0, width: 1400, height: 60 }),
    evidence({ class: "legal" }, { x: 0, y: 3700, width: 1440, height: 300 }),
  ];
  const { report } = inferPatterns([page], { viewports: [viewport(nodes)] });
  assert.equal(header.type, "site-part");
  assert.equal(header.settings.partKey, "header");
  assert.equal(footer.type, "site-part");
  assert.equal(footer.settings.partKey, "footer");
  assert.equal(report.counts.header, 1);
  assert.equal(report.counts.footer, 1);
});

test("captured animations and hover probes become native motion", () => {
  const hero = container({ class: "hero" }, [textNode("heading", "Hello")]);
  const card = container({ class: "tilt" }, [textNode("paragraph", "Body")]);
  const nodes = [
    evidence({ class: "hero" }, { x: 0, y: 0, width: 1200, height: 500 }),
    evidence({ class: "tilt" }, { x: 0, y: 900, width: 300, height: 200 }),
  ];
  const animations = [{
    target: { tag: "div", id: null, classes: ["hero"], framerName: null },
    timing: { duration: 900, delay: 100, easing: "ease-out", iterations: 1, direction: "normal" },
    timeline: null,
    frames: [{ computedOffset: 0, opacity: "0" }, { computedOffset: 1, opacity: "1", transform: "none" }],
  }];
  const hoverEffects = [{ signature: "div|tilt||", changes: { transform: "rotateX(24deg)" }, transition: "0.4s ease", origin: "self" }];
  inferPatterns([hero, card], { viewports: [viewport(nodes, { animations, hoverEffects })] });
  assert.equal(hero.settings.motion.trigger, "load");
  assert.equal(hero.settings.motion.duration, 900);
  assert.equal(card.settings.motion.trigger, "hover");
  assert.equal(card.settings.motion.keyframes[1].transform, "rotateX(24deg)");
  assert.equal(card.settings.motion.duration, 400);
});

test("evidence from a different element is never read into an ambiguous wrapper", () => {
  const wrapperA = container({ class: "" }, [textNode("paragraph", "Alpha")]);
  const wrapperB = container({ class: "" }, [textNode("paragraph", "Bravo")]);
  const page = container({ class: "page" }, [wrapperA, wrapperB]);
  const nodes = [
    evidence({ class: "page" }, { x: 0, y: 0, width: 1440, height: 4000 }),
    evidence({ class: "" }, { x: 0, y: 0, width: 1440, height: 4000 }),
  ];
  const { report } = inferPatterns([page], { viewports: [viewport(nodes)] });
  // A signature shared by elements of different sizes carries no trustworthy geometry, so no
  // fake card grid or duplicated header may appear.
  assert.deepEqual(report.components, []);
});

test("a sticky layer keeps its positioning as native builder data", () => {
  const rail = container({ class: "rail" }, []);
  const nodes = [evidence({ class: "rail" }, { x: 0, y: 0, width: 300, height: 500 }, { position: "sticky", top: "24px", zIndex: "5" })];
  const { report } = inferPatterns([rail], { viewports: [viewport(nodes)] });
  assert.deepEqual(rail.settings.sticky, { enabled: true, top: 24, zIndex: 5 });
  assert.equal(report.counts.sticky, 1);
});

test("hover choreography across a container's children becomes one editable motion group", () => {
  const hover = { enabled: true, trigger: "hover", duration: 400, keyframes: [{ offset: 0 }, { offset: 1, opacity: 0.5 }] };
  const cards = [1, 2, 3].map((index) => container({ class: `card-${index}` }, [textNode("heading", `Card ${index}`)], { motion: hover }));
  const deck = container({ class: "deck" }, cards);
  const { report } = inferPatterns([deck], { viewports: [viewport([evidence({ class: "deck" }, { x: 0, y: 0, width: 900, height: 300 })])] });
  assert.deepEqual(deck.settings.motionGroup, { kind: "unfold", label: "Hover unfold", trigger: "hover", stagger: 60 });
  assert.equal(report.counts.hoverGroup, 1);
});

test("a pinned section whose layers scrub becomes one shared scroll timeline", () => {
  const scroll = { enabled: true, trigger: "scroll", duration: 800, keyframes: [{ offset: 0, opacity: 0 }, { offset: 1, opacity: 1 }] };
  const stage = container({ class: "stage" }, [textNode("heading", "Stage")], { sticky: { enabled: true, top: 0, zIndex: 10 } });
  const layers = [1, 2].map((index) => container({ class: `layer-${index}` }, [], { motion: scroll }));
  const section = container({ class: "scrub" }, [stage, ...layers]);
  const nodes = [evidence({ class: "scrub" }, { x: 0, y: 0, width: 1440, height: 2700 })];
  const { report } = inferPatterns([section], { viewports: [viewport(nodes)] });
  assert.deepEqual(section.settings.motionGroup, {
    kind: "scrub", label: "Pinned scroll timeline", trigger: "scroll", stagger: 0,
    scrub: { reference: "group" }, pin: { enabled: true, distance: 200 },
  });
  assert.equal(report.counts.pin, 1);
});

test("a scroll section without a sticky stage stays an unpinned stagger group", () => {
  const scroll = { enabled: true, trigger: "scroll", duration: 800, keyframes: [{ offset: 0, opacity: 0 }, { offset: 1, opacity: 1 }] };
  const section = container({ class: "band" }, [1, 2].map((index) => container({ class: `item-${index}` }, [], { motion: scroll })));
  const nodes = [evidence({ class: "band" }, { x: 0, y: 0, width: 1440, height: 700 })];
  const { report } = inferPatterns([section], { viewports: [viewport(nodes)] });
  assert.deepEqual(section.settings.motionGroup, { kind: "stagger", label: "Scroll stagger", trigger: "scroll", stagger: 80, scrub: { reference: "group" } });
  assert.equal(report.counts.scrubGroup, 1);
});

test("a radio group with matching labels stays one editable switch, at the outermost region", () => {
  // The radio markup the earlier detector could not read, wrapped in the page's own holder: the
  // holder must never become a second switch, or one toggle would be detected (and marked) twice.
  const monthlyLabel = optionLabel("monthly", "Monthly");
  const yearlyLabel = optionLabel("yearly", "Yearly");
  const row = container({ class: "switch" }, [radio("monthly"), monthlyLabel, radio("yearly"), yearlyLabel]);
  const plans = container({ class: "plans" }, [container({ class: "plan" }, [textNode("paragraph", "$29 per month")])]);
  const pricing = container({ id: "pricing" }, [row, plans]);
  const { report } = inferPatterns([pricing], { viewports: [viewport([evidence({ id: "pricing" }, { x: 0, y: 0, width: 1200, height: 700 })])] });
  assert.deepEqual(pricing.settings.stateNames, ["monthly", "yearly"]);
  assert.equal(pricing.settings.state, "monthly");
  assert.deepEqual(monthlyLabel.settings.interactions, [{ on: "click", action: "setState", target: "query", selector: ".ink-inferred-toggle-1", state: "monthly" }]);
  assert.deepEqual(yearlyLabel.settings.interactions, [{ on: "click", action: "setState", target: "query", selector: ".ink-inferred-toggle-1", state: "yearly" }]);
  assert.equal(report.counts["pricing-switch"], 1);
});

test("sibling <details> become a native accordion without an inline display hint", () => {
  const summary = (text) => ({ type: "inline-text", settings: { importedDom: true, importedTag: "summary", importedAttributes: {}, text } });
  const item = (index) => ({ type: "container", settings: { importedDom: true, importedTag: "details", importedAttributes: {} }, children: [summary(`Question ${index}`), textNode("paragraph", `Answer ${index}`)] });
  const details = [1, 2, 3].map(item);
  const faq = container({ class: "faq" }, details);
  const { report, css } = inferPatterns([faq], { viewports: [viewport([evidence({ class: "faq" }, { x: 0, y: 0, width: 900, height: 360 })])] });
  assert.equal(faq.type, "timeline-accordion");
  assert.equal(report.counts.accordion, 1);
  assert.match(details[0].settings.cssClasses, /ink-inferred-accordion-item/);
  assert.match(details[0].children[0].settings.cssClasses, /ink-inferred-accordion-question/);
  assert.match(details[0].children[1].settings.cssClasses, /ink-inferred-accordion-content/);
  assert.match(css, /ink-inferred-accordion-1/);
});

test("only a questions heading makes a section an FAQ, never body copy", () => {
  const copy = container({ class: "copy-band" }, [textNode("paragraph", "The questions we hear most from teams are answered below.")]);
  const asked = container({ class: "faq-band" }, [textNode("heading", "Questions"), textNode("paragraph", "Answers live in the docs.")]);
  const nodes = [
    evidence({ class: "copy-band" }, { x: 0, y: 0, width: 1200, height: 400 }),
    evidence({ class: "faq-band" }, { x: 0, y: 600, width: 1200, height: 400 }),
  ];
  inferPatterns([copy, asked], { viewports: [viewport(nodes)] });
  assert.notEqual(copy.settings.role, "faq");
  assert.equal(copy.settings.role, "content");
  assert.equal(asked.settings.role, "faq");
});

test("a nested blog index is reported once, at its outermost region", () => {
  const grid = container({ class: "post-grid" }, [1, 2, 3].map((index) => container({ class: "post" }, [link(`Post ${index}`, `/blogs/post-${index}`)])));
  const wrap = container({ class: "wrap" }, [grid]);
  const band = container({ class: "band" }, [wrap]);
  const { report } = inferPatterns([band], { viewports: [viewport([])] });
  assert.equal(report.counts["content-archive"], 1);
});

test("any control with stacked sibling variants becomes one stateful component, price or not", () => {
  const panels = [ "Personal plan details", "Business plan details" ].map((copy) => container({ class: "panel" }, [textNode("paragraph", copy)]));
  const control = container({ class: "switcher" }, [radio("personal"), optionLabel("personal", "Personal"), radio("business"), optionLabel("business", "Business")]);
  const section = container({ class: "plans" }, [control, ...panels]);
  const nodes = [
    evidence({ class: "plans" }, { x: 0, y: 0, width: 1200, height: 560 }),
    // The capture recorded both panels at the same box: the site stacks them and reveals one.
    evidence({ class: "panel" }, { x: 40, y: 120, width: 1120, height: 380 }, { position: "absolute" }),
    evidence({ class: "panel" }, { x: 40, y: 120, width: 1120, height: 380 }, { position: "absolute" }),
  ];
  const { report, css } = inferPatterns([section], { viewports: [viewport(nodes)] });

  assert.deepEqual(section.settings.stateNames, ["personal", "business"]);
  assert.equal(section.settings.state, "personal");
  assert.equal(report.counts["variant-switch"], 1);
  assert.deepEqual(control.children[1].settings.interactions, [{ on: "click", action: "setState", target: "query", selector: ".ink-inferred-toggle-1", state: "personal" }]);
  assert.deepEqual(panels[1].settings.stateNames, ["personal", "business"]);
  assert.equal(panels[1].settings.state, "business");
  assert.match(panels[0].settings.cssClasses, /ink-inferred-toggle-1-variant-1/);
  assert.match(css, /ink-inferred-toggle-1-variant-2\[data-ink-state="business"\]/);
  assert.equal(report.counts["pricing-switch"], undefined);
});

test("equal siblings that sit side by side are not mistaken for stacked variants", () => {
  const panels = [ "Left column", "Right column" ].map((copy) => container({ class: "panel" }, [textNode("paragraph", copy)]));
  const control = container({ class: "switcher" }, [radio("a"), optionLabel("a", "Alpha"), radio("b"), optionLabel("b", "Beta")]);
  const section = container({ class: "band" }, [control, ...panels]);
  const nodes = [
    evidence({ class: "band" }, { x: 0, y: 0, width: 1200, height: 560 }),
    evidence({ class: "panel" }, { x: 0, y: 120, width: 560, height: 380 }),
    evidence({ class: "panel" }, { x: 620, y: 120, width: 560, height: 380 }),
  ];
  const { report } = inferPatterns([section], { viewports: [viewport(nodes)] });

  assert.equal(report.counts["variant-switch"], undefined);
  assert.equal(section.settings.stateNames, undefined);
});

test("a control the pricing switch already owns is not bound a second time", () => {
  const panels = [ "Monthly detail", "Yearly detail" ].map((copy) => container({ class: "price-panel" }, [textNode("paragraph", copy)]));
  const pricing = container({ id: "pricing" }, [
    container({ class: "switch" }, [radio("monthly"), optionLabel("monthly", "Monthly"), radio("yearly"), optionLabel("yearly", "Yearly")]),
    container({ class: "plans" }, [textNode("paragraph", "$29 per month")]),
    ...panels,
  ]);
  const nodes = [
    evidence({ id: "pricing" }, { x: 0, y: 0, width: 1200, height: 700 }),
    evidence({ class: "price-panel" }, { x: 40, y: 300, width: 1120, height: 300 }, { position: "absolute" }),
    evidence({ class: "price-panel" }, { x: 40, y: 300, width: 1120, height: 300 }, { position: "absolute" }),
  ];
  const { report } = inferPatterns([pricing], { viewports: [viewport(nodes)] });

  assert.equal(report.counts["pricing-switch"], 1);
  assert.equal(report.counts["variant-switch"], undefined);
  assert.deepEqual(pricing.settings.stateNames, ["monthly", "yearly"]);
});
