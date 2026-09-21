"use strict";

// General structure inference for the website importer.
//
// Nothing here knows a specific website. Detectors read only the reconstructed source DOM
// (tags, attributes, inline styles, text) plus the capture's computed-style evidence
// (geometry, computed styles, WAAPI animations, stylesheet hover rules, pointer probes),
// matched to the DOM by a class/framer-name signature. Each detector then writes ordinary Ink
// element data — semantic roles, component states, interactions, motion and motion groups — so
// an imported page behaves like a hand-built one and stays editable afterwards.
//
// The result is deliberately additive: the DOM subtree the site shipped is preserved for CSS
// fidelity, and behavior is layered on as native, authorable data.

const EPSILON = 1.5;
const round = (value) => Math.round((Number(value) || 0) * 1000) / 1000;
const clampText = (value, limit = 400) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

const PRICE_PATTERN = /(?:[$€£¥]\s?\d|\d[\d.,]*\s?(?:\/|per\s)\s?(?:mo|month|yr|year|user|seat|mo\.))/i;
const PRICE_CYCLE_PATTERN = /\b(monthly|yearly|annual|annually|per month|per year|month|year)\b/i;
const ARCHIVE_SEGMENT = /^(blog|blogs|post|posts|article|articles|news|insights?|stories)$/i;

// An article URL has an archive segment followed by a slug, so "…/blogs/why-we-built-x" is a post
// while "…/blogs.html" is only the index.
function isArticleLink(href) {
  try {
    const segments = new URL(String(href || ""), "https://ink.invalid/").pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    const index = segments.findIndex((segment) => ARCHIVE_SEGMENT.test(segment));
    return index >= 0 && index < segments.length - 1;
  } catch (_) { return false; }
}
const NAV_ROLE_LABELS = { nav: "Nav", hero: "Hero", features: "Features", pricing: "Pricing", testimonials: "Testimonials", faq: "FAQ", cta: "Call to action", blog: "Blog", form: "Form", footer: "Footer", content: "Section" };

function settingsOf(node) { if (!node.settings) node.settings = {}; return node.settings; }

function attributesOf(node) {
  const raw = settingsOf(node).importedAttributes;
  if (!raw) return {};
  if (typeof raw === "string") { try { return JSON.parse(raw) || {}; } catch (_) { return {}; } }
  return raw;
}

function classListOf(node) { return String(attributesOf(node).class || "").split(/\s+/).filter(Boolean); }

function inlineStyles(node) {
  const declarations = String(attributesOf(node).style || "").split(";");
  const styles = {};
  declarations.forEach((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator < 0) return;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (property && value) styles[property] = value;
  });
  return styles;
}

function tagOf(node) { return String(settingsOf(node).importedTag || settingsOf(node).tag || "").toLowerCase(); }
function framerNameOf(node) { return String(attributesOf(node)["data-framer-name"] || ""); }
function roleOf(node) { return String(attributesOf(node).role || "").toLowerCase(); }
function childrenOf(node) { return Array.isArray(node.children) ? node.children : []; }

function textOf(node, limit = 600) {
  let out = "";
  const visit = (current) => {
    if (out.length > limit) return;
    const nodeSettings = current.settings || {};
    const segments = nodeSettings.importedTextSegments || nodeSettings.textSegments;
    if (Array.isArray(segments)) segments.forEach((segment) => { out += ` ${segment == null ? "" : segment}`; });
    if (typeof nodeSettings.text === "string") out += ` ${nodeSettings.text}`;
    childrenOf(current).forEach(visit);
  };
  visit(node);
  return clampText(out, limit);
}

function walk(node, visit, depth = 0) {
  if (!node || typeof node !== "object") return;
  visit(node, depth);
  childrenOf(node).forEach((child) => walk(child, visit, depth + 1));
}

function collect(node, predicate, out = []) {
  walk(node, (candidate) => { if (predicate(candidate)) out.push(candidate); });
  return out;
}

function closestAncestor(node, predicate) {
  let current = node;
  while (current) {
    if (predicate(current)) return current;
    current = current.__inkParent || null;
  }
  return null;
}

// Index every ancestor so detectors can ask "which matched container owns this node?".
function linkParents(roots) {
  const visit = (node, parent) => {
    Object.defineProperty(node, "__inkParent", { value: parent, enumerable: false, configurable: true, writable: true });
    childrenOf(node).forEach((child) => visit(child, node));
  };
  roots.forEach((root) => visit(root, null));
}

function signatureOf(tag, classes, framerName, id) {
  return `${String(tag || "").toLowerCase()}|${[...(classes || [])].map((name) => String(name)).sort().join(".")}|${framerName || ""}|${id || ""}`;
}
function signatureOfNode(node) { return signatureOf(tagOf(node), classListOf(node), framerNameOf(node), attributesOf(node).id || null); }

// ---------------------------------------------------------------------------------------------
// Evidence

function createEvidence(viewports) {
  const ordered = [...(viewports || [])].filter(Boolean).sort((left, right) => (right.viewport?.width || 0) - (left.viewport?.width || 0));
  const bySignature = new Map();
  const entries = [];
  ordered.forEach((viewport) => (viewport.nodes || []).forEach((entry, position) => {
    const record = { entry, viewport, position, key: signatureOf(entry.tag, entry.classes || [], entry.framerName, entry.id) };
    entries.push(record);
    const bucket = bySignature.get(record.key);
    if (bucket) bucket.push(record); else bySignature.set(record.key, [record]);
  }));
  const hoverBySignature = new Map();
  ordered.forEach((viewport) => (viewport.hoverEffects || []).forEach((effect) => {
    if (effect && effect.signature && !hoverBySignature.has(effect.signature)) hoverBySignature.set(effect.signature, effect);
  }));
  const animationBySignature = new Map();
  ordered.forEach((viewport) => (viewport.animations || []).forEach((animation) => {
    const target = animation?.target;
    if (!target) return;
    const key = signatureOf(target.tag, target.classes || [], target.framerName, target.id);
    if (!animationBySignature.has(key)) animationBySignature.set(key, animation);
  }));

  // A signature shared by several captured elements carries no trustworthy geometry: the same
  // classless wrapper appears all over a page. Resolve through text when it is unambiguous and
  // otherwise report no evidence, so detectors never read one element's layout into another's.
  const primaryViewport = ordered[0];
  const resolve = (node) => {
    const bucket = bySignature.get(signatureOfNode(node));
    if (!bucket || !bucket.length) return null;
    // Geometry always comes from the widest captured viewport: a responsive layout legitimately
    // resizes the same element, and only the desktop pass describes the authored composition.
    const pool = bucket.filter((record) => record.viewport === primaryViewport);
    const candidates = pool.length ? pool : bucket;
    if (candidates.length === 1) return candidates[0];
    const text = clampText(textOf(node, 80), 80);
    if (text) {
      const matching = candidates.filter((record) => {
        const candidate = clampText(record.entry.text || "", 80);
        return candidate && (candidate === text || candidate.startsWith(text) || text.startsWith(candidate));
      });
      if (matching.length) return matching[0];
    }
    // Repeated components (the same card rendered several times) share a signature and a size,
    // so their geometry is still trustworthy.
    const first = candidates[0].entry.rect;
    if (candidates.length <= 24 && first && candidates.every((record) => record.entry.rect
      && Math.abs(record.entry.rect.width - first.width) <= 2
      && Math.abs(record.entry.rect.height - first.height) <= 2)) return candidates[0];
    return null;
  };
  return {
    viewports: ordered,
    width: ordered[0]?.viewport?.width || 1440,
    height: ordered[0]?.viewport?.height || 900,
    documentHeight: ordered[0]?.document?.height || 0,
    match(node) { return resolve(node); },
    matchEntry(node) { return this.match(node)?.entry || null; },
    matchAll(node) { const key = signatureOfNode(node); return entries.filter((record) => record.key === key); },
    hover(node) { return hoverBySignature.get(signatureOfNode(node)) || null; },
    animation(node) { return animationBySignature.get(signatureOfNode(node)) || null; },
    animations: ordered[0]?.animations || [],
    hoverRules: ordered[0]?.hoverRules || [],
  };
}

const evidenceRect = (evidence, node) => evidence.match(node)?.entry?.rect || null;
const evidenceStyle = (evidence, node) => evidence.match(node)?.entry?.style || null;
const evidenceText = (evidence, node) => evidence.match(node)?.entry?.text || "";

// ---------------------------------------------------------------------------------------------
// Transform math

function parsePose(value) {
  const text = String(value || "");
  const pose = { translateX: 0, translateY: 0, translateZ: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 };
  const triple = text.match(/translate3d\(([^)]+)\)/i);
  if (triple) {
    const parts = triple[1].split(",").map((part) => Number.parseFloat(part) || 0);
    pose.translateX = parts[0] || 0; pose.translateY = parts[1] || 0; pose.translateZ = parts[2] || 0;
  }
  const pair = text.match(/translate\(([^)]+)\)/i);
  if (pair) { const parts = pair[1].split(",").map((part) => Number.parseFloat(part) || 0); pose.translateX += parts[0] || 0; pose.translateY += parts[1] || 0; }
  const single = (name) => { const match = text.match(new RegExp(`${name}\\(([^)]+)\\)`, "i")); return match ? Number.parseFloat(match[1]) || 0 : 0; };
  pose.translateX += single("translateX"); pose.translateY += single("translateY"); pose.translateZ += single("translateZ");
  pose.rotateX = single("rotateX"); pose.rotateY = single("rotateY");
  pose.rotateZ = single("rotateZ") || single("rotate");
  const scale = text.match(/scale\(([^)]+)\)/i);
  if (scale) pose.scale = Number.parseFloat(scale[1]) || 1;
  return pose;
}

// Read a pose back out of a resolved matrix (matrix/matrix3d), so evidence works even when the
// site animates transforms from JavaScript instead of declaring them in markup.
function poseFromMatrix(value) {
  const text = String(value || "");
  if (text.startsWith("none") || !text) return null;
  // Read only the argument list: scanning the whole string would also pick the digits in
  // "matrix3d"/"rotate3d" and shift every component.
  const open = text.indexOf("(");
  const args = open >= 0 ? text.slice(open + 1, text.lastIndexOf(")")) : text;
  const numbers = (args.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
  if (/^matrix3d/i.test(text) && numbers.length >= 16) {
    const rotateY = Math.atan2(numbers[2], numbers[0]) * 180 / Math.PI;
    const rotateX = -Math.atan2(numbers[6], numbers[10]) * 180 / Math.PI;
    return { translateX: numbers[12] || 0, translateY: numbers[13] || 0, translateZ: numbers[14] || 0, rotateX: round(rotateX), rotateY: round(rotateY), rotateZ: 0, scale: 1 };
  }
  if (/^matrix\(/i.test(text) && numbers.length >= 6) {
    return { translateX: numbers[4] || 0, translateY: numbers[5] || 0, translateZ: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 };
  }
  return null;
}

// Poses are matched coarsely: a live orbit is captured mid-transition, so a rounded rotation and
// depth bucket is what lines a rendered card up with its authored pose.
function poseSignature(pose) { return [round(pose.rotateX), round(pose.rotateY), Math.round(pose.translateZ / 25) * 25].join(":"); }
function poseIsIdentity(pose) { return !pose.translateX && !pose.translateY && !pose.translateZ && !pose.rotateX && !pose.rotateY && !pose.rotateZ && pose.scale === 1; }
function poseToTransform(pose) {
  const parts = [];
  if (pose.translateX || pose.translateY || pose.translateZ) parts.push(`translate3d(${round(pose.translateX)}px,${round(pose.translateY)}px,${round(pose.translateZ)}px)`);
  if (pose.rotateX) parts.push(`rotateX(${round(pose.rotateX)}deg)`);
  if (pose.rotateY) parts.push(`rotateY(${round(pose.rotateY)}deg)`);
  if (pose.rotateZ) parts.push(`rotateZ(${round(pose.rotateZ)}deg)`);
  if (pose.scale !== 1) parts.push(`scale(${round(pose.scale)})`);
  return parts.join(" ") || "none";
}

// ---------------------------------------------------------------------------------------------
// Annotation helpers

function addClass(node, ...names) {
  const nodeSettings = settingsOf(node);
  const existing = String(nodeSettings.cssClasses || "").split(/\s+/).filter(Boolean);
  names.filter(Boolean).forEach((name) => { if (!existing.includes(name)) existing.push(name); });
  nodeSettings.cssClasses = existing.join(" ");
}

function setInteractions(node, records) {
  const nodeSettings = settingsOf(node);
  const existing = Array.isArray(nodeSettings.interactions) ? nodeSettings.interactions : [];
  nodeSettings.interactions = [...existing, ...records];
}

function insideSitePart(node) {
  let current = node;
  while (current) {
    if (settingsOf(current).partKey) return true;
    current = current.__inkParent || null;
  }
  return false;
}

function markComponent(node, kind, detail = {}, report) {
  const nodeSettings = settingsOf(node);
  nodeSettings.inferredComponent = { kind, ...detail };
  if (!nodeSettings.label && NAV_ROLE_LABELS[kind]) nodeSettings.label = NAV_ROLE_LABELS[kind];
  report.components.push({ kind, label: nodeSettings.label || framerNameOf(node) || kind, ...detail });
}

// ---------------------------------------------------------------------------------------------
// Detectors

// A 3D orbit: a perspective container whose children carry rotateY/translateZ poses. Framer and
// Webflow both emit the poses in markup (or resolve them to matrices), so the cycle can be read
// back exactly instead of hard-coding one site's stack.
function detectOrbit3d(roots, ctx) {
  const { evidence, report, css } = ctx;
  const parents = collect(roots.length ? { children: roots } : null, (node) => {
    const style = inlineStyles(node);
    const transform = String(style.transform || "");
    const evidenceStyle_ = evidenceStyle(evidence, node) || {};
    return /perspective\(/i.test(transform) || /preserve-3d/i.test(String(style["transform-style"] || "")) || /preserve-3d/i.test(String(evidenceStyle_["transformStyle"] || "")) || (evidenceStyle_.perspective && evidenceStyle_.perspective !== "none");
  }).filter((node) => node !== roots);

  let index = 0;
  parents.forEach((parent) => {
    const carrierSet = new Set();
    const parentSet = new Set(parents);
    const carriers = [];
    walk(parent, (candidate) => {
      if (candidate === parent || carrierSet.has(candidate)) return;
      const transformText = String(inlineStyles(candidate).transform || "");
      if (!/rotateY\(|rotateX\(|translateZ\(/i.test(transformText)) return;
      // A nested perspective container owns its own cards; do not animate them twice.
      let ancestor = candidate.__inkParent;
      while (ancestor && ancestor !== parent) { if (parentSet.has(ancestor)) return; ancestor = ancestor.__inkParent; }
      carrierSet.add(candidate);
      carriers.push(candidate);
    });
    if (carriers.length < 3) return;
    // Cards are labelled 1..n in most component libraries; otherwise DOM order is the cycle.
    const labeled = carriers.every((node) => /^\d+$/.test(framerNameOf(node)));
    const ordered = labeled ? [...carriers].sort((left, right) => Number(framerNameOf(left)) - Number(framerNameOf(right))) : carriers;
    const offsets = new Map();
    const parentRect = evidenceRect(evidence, parent);
    ordered.forEach((node) => {
      const rect = evidenceRect(evidence, node);
      if (!rect || !parentRect) return;
      // A JS-driven orbit is caught mid-flight, so read the rendered pose from the resolved
      // matrix and attach the measured lateral offset to that pose. A resolved `none` means the
      // card was resting at the origin, which is itself a pose.
      const renderedStyle = String((evidenceStyle(evidence, node) || {}).transform || "");
      const rendered = poseFromMatrix(renderedStyle)
        || (renderedStyle === "none" ? { translateX: 0, translateY: 0, translateZ: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 } : null)
        || (renderedStyle ? null : parsePose(inlineStyles(node).transform));
      if (!rendered) return;
      offsets.set(poseSignature(rendered), round((rect.x + rect.width / 2) - (parentRect.x + parentRect.width / 2)));
    });
    const poses = [];
    const seen = new Set();
    ordered.forEach((node) => {
      const parsed = parsePose(inlineStyles(node).transform);
      const key = poseSignature(parsed);
      if (seen.has(key)) return;
      seen.add(key);
      poses.push({ ...parsed, translateX: offsets.get(key) ?? parsed.translateX });
    });
    if (poses.length < 3) return;
    const perspectiveMatch = String(inlineStyles(parent).transform || "").match(/perspective\(([^)]+)\)/i);
    const perspective = perspectiveMatch ? Number.parseFloat(perspectiveMatch[1]) || 1200 : Number.parseFloat(String((evidenceStyle(evidence, parent) || {}).perspective || "")) || 1200;
    const duration = 6000;
    ordered.forEach((node, position) => {
      const keyframes = [];
      for (let step = 0; step <= poses.length; step += 1) {
        const pose = poses[(position + step) % poses.length];
        keyframes.push({ offset: step / poses.length, transform: poseToTransform(pose) });
      }
      const nodeSettings = settingsOf(node);
      nodeSettings.motion = { enabled: true, trigger: "load", duration, delay: 0, easing: "linear", iterations: "infinite", direction: "normal", keyframes };
      nodeSettings.label = nodeSettings.label || `Orbit card ${position + 1}`;
    });
    settingsOf(parent).motionGroup = { kind: "orbit3d", label: "3D orbit", perspective, count: poses.length };
    addClass(parent, `ink-inferred-orbit-${++index}`);
    css.push(`.ink-canvas-root .ink-inferred-orbit-${index}{transform-style:preserve-3d}.ink-canvas-root .ink-inferred-orbit-${index} > *{transform-style:preserve-3d}`);
    markComponent(parent, "orbit3d", { count: poses.length, perspective, cards: ordered.length }, report);
  });
}

// Entrance animations the site actually ran (WAAPI) become native, editable motion. The same
// data a designer would type into the Motion panel is what the importer writes.
function detectMotion(roots, ctx) {
  const { evidence, report, css } = ctx;
  let index = 0;
  walk({ children: roots }, (node) => {
    if (!node.type) return;
    const nodeSettings = settingsOf(node);
    if (nodeSettings.motion) return;
    const animation = evidence.animation(node);
    if (animation) {
      const frames = (animation.frames || []).filter((frame) => frame && (frame.transform || frame.opacity || frame.filter));
      if (frames.length >= 2) {
        const timing = animation.timing || {};
        const keyframes = frames.slice(0, 12).map((frame, position) => {
          const computedOffset = Number.isFinite(Number(frame.computedOffset)) ? Number(frame.computedOffset) : (frames.length === 1 ? 0 : position / (frames.length - 1));
          const keyframe = { offset: round(Math.max(0, Math.min(1, computedOffset))) };
          ["transform", "opacity", "filter"].forEach((property) => { if (frame[property] != null && frame[property] !== "") keyframe[property] = String(frame[property]); });
          return keyframe;
        });
        if (keyframes.length >= 2 && (keyframes.some((frame) => frame.transform) || keyframes.some((frame) => frame.opacity !== undefined))) {
          const rect = evidenceRect(evidence, node);
          const scrollDriven = /Scroll/i.test(String(animation.timeline || ""));
          const inFirstView = rect ? rect.y < evidence.height * 1.4 : true;
          nodeSettings.motion = {
            enabled: true,
            trigger: scrollDriven ? "scroll" : (inFirstView ? "load" : "enter"),
            duration: Math.max(80, Math.round(Number(timing.duration) || 600)),
            delay: Math.max(0, Math.round(Number(timing.delay) || 0)),
            easing: /^(linear|ease|ease-in|ease-out|ease-in-out)$/.test(String(timing.easing || "")) ? String(timing.easing) : "cubic-bezier(.16,1,.3,1)",
            iterations: timing.iterations === Infinity ? "infinite" : Math.max(1, Math.min(6, Number(timing.iterations) || 1)),
            direction: ["normal", "reverse", "alternate", "alternate-reverse"].includes(timing.direction) ? timing.direction : "normal",
            keyframes,
          };
          index += 1;
        }
      }
    }
    const hover = evidence.hover(node);
    if (!hover || nodeSettings.motion) return;
    const changes = hover.changes || {};
    const keyframe = {};
    ["transform", "opacity", "filter"].forEach((property) => {
      const value = changes[property];
      if (value == null || value === "" || value === "none") return;
      if (property === "opacity" && Number(value) === 1) return;
      keyframe[property] = String(value);
    });
    if (!Object.keys(keyframe).length) return;
    const transitionMatch = String(hover.transition || "").match(/([\d.]+)(m?s)\s+([^,;]+)/i);
    nodeSettings.motion = {
      enabled: true,
      trigger: "hover",
      duration: transitionMatch ? Math.max(40, Math.round(Number(transitionMatch[1]) * (/ms/i.test(transitionMatch[2]) ? 1 : 1000))) : 480,
      delay: 0,
      easing: transitionMatch ? clampText(transitionMatch[3], 40) : "cubic-bezier(.22,1,.36,1)",
      iterations: 1,
      direction: "normal",
      keyframes: [{ offset: 0 }, { offset: 1, ...keyframe }],
    };
    index += 1;
  });
  if (index) report.notices.push(`${index} captured animations became editable native motion.`);
}

// Stylesheet hover rules are the other half of hover choreography. They are recorded as evidence
// and converted to native hover motion on the elements whose classes they target.
function detectStylesheetHover(roots, ctx) {
  const { evidence, report } = ctx;
  const rules = (evidence.hoverRules || []).filter((rule) => {
    if (!rule || !rule.selector) return false;
    if (/::?before|::?after|framer-text/.test(rule.selector)) return false;
    return Object.keys(rule.declarations || {}).some((property) => ["transform", "opacity", "filter", "box-shadow"].includes(property));
  });
  if (!rules.length) return;
  let applied = 0;
  rules.slice(0, 240).forEach((rule) => {
    const tokens = rule.selector.replace(/:hover/g, "").split(",").map((part) => part.trim().split(/\s+/).pop()).filter(Boolean);
    tokens.forEach((token) => {
      const className = token.match(/\.([A-Za-z_][\w-]*)$/)?.[1];
      if (!className) return;
      walk({ children: roots }, (node) => {
        if (!node.type || settingsOf(node).motion) return;
        if (!classListOf(node).includes(className)) return;
        const keyframe = {};
        ["transform", "opacity", "filter", "box-shadow"].forEach((property) => {
          const value = rule.declarations[property];
          if (!value || value === "none") return;
          if (property === "opacity" && Number(value) === 1) return;
          keyframe[property === "box-shadow" ? "filter" : property] = value;
        });
        if (!Object.keys(keyframe).length) return;
        settingsOf(node).motion = { enabled: true, trigger: "hover", duration: 420, delay: 0, easing: "cubic-bezier(.22,1,.36,1)", iterations: 1, direction: "normal", keyframes: [{ offset: 0 }, { offset: 1, ...keyframe }] };
        applied += 1;
      });
    });
  });
  if (applied) report.notices.push(`${applied} stylesheet hover rules became editable native hover motion.`);
}

// A navigation region: a <nav>/<header>, or the top-of-page link bar. Records the link list and
// rebuilds the mobile panel the site renders from component code (which is never in the source).
function detectNavigation(roots, ctx) {
  const { evidence, report, css } = ctx;
  const navRoots = collect({ children: roots }, (node) => {
    const tag = tagOf(node);
    if (tag === "nav" || tag === "header") return true;
    const rect = evidenceRect(evidence, node);
    if (!rect || rect.y > 180 || rect.width < evidence.width * 0.55 || rect.height > 220) return false;
    return collect(node, (candidate) => tagOf(candidate) === "a" && clampText(textOf(candidate), 40).length > 1).length >= 2;
  });
  const nav = navRoots[0];
  if (!nav) return;
  const links = collect(nav, (candidate) => tagOf(candidate) === "a" && clampText(textOf(candidate), 60).length > 1 && !/^#/.test(String(attributesOf(candidate).href || "")))
    .map((candidate) => ({ text: clampText(textOf(candidate), 48), url: String(attributesOf(candidate).href || "#") }))
    .filter((link, position, list) => link.text && list.findIndex((entry) => entry.text === link.text) === position)
    .slice(0, 10);
  const navSettings = settingsOf(nav);
  navSettings.role = navSettings.role || "nav";
  markComponent(nav, "nav", { links: links.length }, report);
  if (links.length < 2) return;

  // A menu control is a small, text-free interactive node inside the bar. It is the standard
  // hamburger shape regardless of the framework.
  const barRect = evidenceRect(evidence, nav);
  const controls = collect(nav, (candidate) => {
    if (clampText(textOf(candidate), 40)) return false;
    if (/^(a|button)$/.test(tagOf(candidate))) return true;
    const attributes = attributesOf(candidate);
    if (attributes["aria-expanded"] != null || attributes["aria-controls"] != null) return true;
    const rect = evidenceRect(evidence, candidate);
    if (!rect || rect.width > 72 || rect.height > 72 || rect.width < 10 || rect.height < 10) return false;
    if (collect(candidate, (child) => /^(svg|img|i)$/.test(tagOf(child))).length >= 1) return true;
    // Icon-less hamburgers are a stack of thin bars, or a bare clickable box.
    const inner = childrenOf(candidate);
    if (!inner.length) return true;
    return inner.length >= 2 && inner.every((child) => (evidenceRect(evidence, child) || {}).height <= 8);
  });
  const toggle = controls.reverse().find((candidate) => {
    const rect = evidenceRect(evidence, candidate);
    return !rect || !barRect || Math.abs((rect.y + rect.height / 2) - (barRect.y + barRect.height / 2)) < Math.max(40, barRect.height * 0.75);
  }) || controls[0];
  if (!toggle) return;

  const index = ++ctx.counters.nav;
  const panel = { type: "container", settings: { tag: "div", layout: "full", cssClasses: `ink-inferred-nav-panel ink-inferred-nav-panel-${index}`, label: "Mobile menu", stateNames: ["closed", "open"], state: "closed" }, children: links.map((link) => ({ type: "link", settings: { text: link.text, url: link.url, cssClasses: "ink-inferred-nav-link" } })) };
  nav.children = [...childrenOf(nav), panel];
  addClass(nav, `ink-inferred-nav-${index}`);
  settingsOf(toggle).interactions = [{ on: "click", action: "toggleState", target: "query", selector: `.ink-inferred-nav-panel-${index}`, state: "open" }];
  settingsOf(toggle).ariaExpandedBound = true;
  css.push(
    `.ink-canvas-root .ink-inferred-nav-panel-${index}{display:none;flex-direction:column;gap:10px;padding:18px 20px;width:100%}`,
    `.ink-canvas-root .ink-inferred-nav-link{display:block;padding:8px 0;font:600 16px/1.3 inherit;color:inherit;text-decoration:none}`,
    `@media(max-width:991px){.ink-canvas-root .ink-inferred-nav-${index}{position:relative}.ink-canvas-root .ink-inferred-nav-panel-${index}{position:absolute;left:0;right:0;top:100%;z-index:60;background:var(--ink-import-surface,var(--ink-color-surface,#111));color:inherit}.ink-canvas-root .ink-inferred-nav-panel-${index}[data-ink-state="open"]{display:flex}}`,
  );
  report.notices.push("The navigation's mobile panel was not in the source; it was rebuilt from the desktop links and is editable.");
}

// Tabs: an ARIA tab list, or a row of labelled siblings where one is the active variant and the
// panels are stacked on top of each other. Both become native component states.
function detectTabs(roots, ctx) {
  const { evidence, report, css } = ctx;
  const arLists = collect({ children: roots }, (node) => collect(node, (candidate) => roleOf(candidate) === "tab").length >= 2);
  const roots_ = arLists.length ? arLists : collect({ children: roots }, (node) => {
    const children = childrenOf(node);
    if (children.length < 2) return false;
    const labels = new Set(children.map((child) => framerNameOf(child)).filter(Boolean));
    if (!labels.has("Active") || !labels.has("Inactive")) return false;
    const siblings = childrenOf(node.__inkParent || node);
    const stacked = siblings.filter((candidate) => {
      const rect = evidenceRect(evidence, candidate);
      return rect && rect.width > evidence.width * 0.5 && rect.height > 80;
    });
    return stacked.length >= 2;
  });
  roots_.slice(0, 4).forEach((list, position) => {
    const tabs = collect(list, (candidate) => roleOf(candidate) === "tab" || /^(Active|Inactive)$/.test(framerNameOf(candidate)));
    if (tabs.length < 2) return;
    const parent = list.__inkParent;
    if (!parent) return;
    const panels = collect(parent, (candidate) => roleOf(candidate) === "tabpanel");
    const stacked = panels.length >= 2 ? panels : childrenOf(parent).filter((candidate) => {
      const rect = evidenceRect(evidence, candidate);
      return rect && rect.width > evidence.width * 0.45 && rect.height > 120;
    });
    if (stacked.length < 2) return;
    const group = `ink-inferred-tabs-${position + 1}`;
    addClass(parent, group);
    const visibleDisplay = stacked.map((candidate) => (evidenceStyle(evidence, candidate) || {}).display).find((display) => display && display !== "none") || "block";
    const values = tabs.map((tab) => clampText(textOf(tab), 32) || "tab");
    tabs.forEach((tab, index) => {
      const panel = stacked[Math.min(index, stacked.length - 1)];
      setInteractions(tab, [{ on: "click", action: "setState", target: "query", selector: `.${group}-panel-${index + 1}`, state: "selected", exclusive: true }]);
      settingsOf(tab).stateNames = ["selected", "unselected"];
      settingsOf(tab).state = index === 0 ? "selected" : "unselected";
      settingsOf(tab).stateGroup = `${group}-tabs`;
    });
    stacked.forEach((panel, index) => {
      addClass(panel, `${group}-panel-${index + 1}`);
      const panelSettings = settingsOf(panel);
      panelSettings.stateNames = ["selected", "unselected"];
      const visible = (evidenceStyle(evidence, panel) || {}).display !== "none";
      panelSettings.state = visible ? "selected" : "unselected";
      panelSettings.stateGroup = `${group}-panels`;
      css.push(
        `.ink-canvas-root .${group}-panel-${index + 1}[data-ink-state="unselected"]{display:none!important}`,
        `.ink-canvas-root .${group}-panel-${index + 1}[data-ink-state="selected"]{display:${visibleDisplay}!important}`,
      );
    });
    markComponent(parent, "tabs", { tabs: tabs.length, panels: stacked.length, labels: values }, report);
  });
}

// A pricing switch: two short labelled options beside price text. The container becomes the state
// holder and the options become native state setters, so the switch is editable, not decorative.
function detectPricingToggle(roots, ctx) {
  const { evidence, report, css } = ctx;
  const candidates = collect({ children: roots }, (node) => {
    const text = textOf(node, 4000);
    if (!PRICE_PATTERN.test(text) || !PRICE_CYCLE_PATTERN.test(text)) return false;
    const options = childrenOf(node).flatMap((child) => childrenOf(child)).filter((child) => /^(a|button)$/.test(tagOf(child)) && clampText(textOf(child), 24).length <= 16);
    return options.length >= 2;
  });
  candidates.slice(0, 3).forEach((container, position) => {
    const options = childrenOf(container).flatMap((child) => childrenOf(child)).filter((child) => /^(a|button)$/.test(tagOf(child)) && clampText(textOf(child), 24).length <= 16);
    const labels = options.map((option) => clampText(textOf(option), 24).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).filter(Boolean);
    if (labels.length < 2) return;
    const group = `ink-inferred-toggle-${position + 1}`;
    addClass(container, group);
    const containerSettings = settingsOf(container);
    containerSettings.stateNames = [...new Set(labels)];
    containerSettings.state = containerSettings.stateNames[0];
    options.forEach((option, index) => {
      const label = labels[index];
      if (!label) return;
      setInteractions(option, [{ on: "click", action: "setState", target: "query", selector: `.${group}`, state: label }]);
      settingsOf(option).stateNames = containerSettings.stateNames;
      settingsOf(option).state = label;
    });
    // Stacked variant pairs (the site renders every price state on top of one another) can be
    // bound to the same states so the generated CSS shows one at a time.
    const variants = childrenOf(container).filter((child) => (evidenceRect(evidence, child) || {}).width > evidence.width * 0.4);
    const seenRects = new Map();
    variants.forEach((child) => {
      const rect = evidenceRect(evidence, child);
      if (!rect) return;
      const key = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      seenRects.set(key, (seenRects.get(key) || 0) + 1);
    });
    const stackedKey = [...seenRects.entries()].sort((left, right) => right[1] - left[1])[0];
    if (stackedKey && stackedKey[1] >= containerSettings.stateNames.length) {
      const group_ = variants.filter((child) => {
        const rect = evidenceRect(evidence, child);
        return rect && `${Math.round(rect.width)}x${Math.round(rect.height)}` === stackedKey[0];
      }).slice(0, containerSettings.stateNames.length);
      group_.forEach((variant, index) => {
        addClass(variant, `${group}-variant-${index + 1}`);
        const variantSettings = settingsOf(variant);
        variantSettings.stateNames = containerSettings.stateNames;
        variantSettings.state = containerSettings.stateNames[index];
        css.push(`.ink-canvas-root .${group}-variant-${index + 1}[data-ink-state]{display:none!important}`,
          `.ink-canvas-root .${group}-variant-${index + 1}[data-ink-state="${containerSettings.stateNames[index]}"]{display:block!important}`);
      });
    }
    markComponent(container, "pricing-switch", { states: containerSettings.stateNames }, report);
  });
}

// How many cards sit side by side. The container's own grid/flex declaration is authoritative;
// otherwise the children's positions answer it, and when every child reports the same geometry
// (a repeated class collapses several nodes onto one captured element) fall back to width.
function columnCount(grid, children, rects, evidence) {
  const style = evidenceStyle(evidence, grid) || {};
  const tracks = String(style.gridTemplateColumns || "").split(/\s+/).filter((track) => /(px|fr|%|em|rem|vw)/.test(track)).length;
  if (/grid/.test(String(style.display || "")) && tracks) return Math.min(tracks, children.length);
  const positioned = rects.filter(Boolean);
  if (!positioned.length) return 1;
  const rows = new Map();
  positioned.forEach((rect) => rows.set(Math.round(rect.y), (rows.get(Math.round(rect.y)) || 0) + 1));
  const widestRow = Math.max(...rows.values());
  const distinctRows = rows.size;
  if (distinctRows > 1) return Math.max(1, Math.min(widestRow, children.length));
  const parentRect = evidenceRect(evidence, grid);
  const cardWidth = Math.max(...positioned.map((rect) => rect.width));
  if (parentRect && cardWidth > 0) return Math.max(1, Math.min(children.length, Math.round((parentRect.width + 24) / (cardWidth + 24))));
  return 1;
}

// Repeated sibling cards become a named grid component: the same DOM, now legible as one reusable
// piece with a column count instead of anonymous nested boxes.
function detectCardGrid(roots, ctx) {
  const { evidence, report } = ctx;
  let index = 0;
  const candidates = collect({ children: roots }, (node) => {
    if (insideSitePart(node)) return false;
    const children = childrenOf(node).filter((child) => !["script", "style"].includes(tagOf(child)));
    if (children.length < 3) return false;
    const rects = children.map((child) => evidenceRect(evidence, child)).filter(Boolean);
    if (rects.length < 3) return false;
    const signatures = children.map((child) => `${tagOf(child)}:${childrenOf(child).map(tagOf).join(",")}`);
    const commonest = signatures.sort((left, right) => signatures.filter((item) => item === right).length - signatures.filter((item) => item === left).length)[0];
    if (signatures.filter((signature) => signature === commonest).length < 3) return false;
    const heights = rects.map((rect) => rect.height);
    const shortest = Math.min(...heights);
    const tallest = Math.max(...heights);
    return shortest > 40 && tallest < shortest * 2.4 + 80;
  });
  candidates.slice(0, 12).forEach((grid) => {
    const children = childrenOf(grid).filter((child) => !["script", "style"].includes(tagOf(child)));
    const rects = children.map((child) => evidenceRect(evidence, child));
    const columns = columnCount(grid, children, rects, evidence);
    if (!columns) return;
    addClass(grid, `ink-inferred-grid-${++index}`);
    children.forEach((child) => { settingsOf(child).role = settingsOf(child).role || "card"; });
    markComponent(grid, "card-grid", { count: children.length, columns }, report);
  });
}

// Content-card routing: repeated cards that link to article-like paths are a post archive, which
// is what a theme's blog index needs to be rebuilt natively.
function detectContentArchive(roots, ctx) {
  const { evidence, report } = ctx;
  const candidates = collect({ children: roots }, (node) => {
    if (insideSitePart(node)) return false;
    const links = collect(node, (candidate) => tagOf(candidate) === "a" && isArticleLink(attributesOf(candidate).href));
    if (links.length < 3) return false;
    const rect = evidenceRect(evidence, node);
    return !rect || rect.height > 120;
  });
  candidates.slice(0, 2).forEach((archive) => {
    const links = collect(archive, (candidate) => tagOf(candidate) === "a" && isArticleLink(attributesOf(candidate).href));
    markComponent(archive, "content-archive", { links: links.length }, report);
  });
}

// Accordions: repeated items that each hold a short trigger plus a content block the browser is
// clipping at rest (absolutely positioned with hidden overflow, or display:none). The marker
// classes let the shared timeline widget drive any site's markup instead of one framework's
// layer names.
function detectAccordion(roots, ctx) {
  const { evidence, report, css } = ctx;
  const candidates = collect({ children: roots }, (node) => {
    if (insideSitePart(node)) return false;
    const items = childrenOf(node).filter((child) => !/^(script|style)$/.test(tagOf(child)));
    if (items.length < 3) return false;
    const rects = items.map((item) => evidenceRect(evidence, item)).filter(Boolean);
    if (rects.length >= 3 && Math.abs(rects[0].width - rects[1].width) < 4) return true;
    return /timeline|accordion|faq|question/i.test(`${framerNameOf(node)} ${classListOf(node).join(" ")}`);
  });
  let index = 0;
  candidates.slice(0, 3).forEach((accordion) => {
    const items = childrenOf(accordion).filter((child) => !/^(script|style)$/.test(tagOf(child)));
    const panelFor = (item) => collect(item, (candidate) => {
      if (candidate === item) return false;
      const style = evidenceStyle(evidence, candidate) || {};
      const clipped = /hidden|clip|auto/.test(String(style.overflow || "")) && /absolute/.test(String(style.position || ""));
      const hidden = String(style.display || "") === "none";
      return (clipped || hidden) && textOf(candidate, 200).length >= 40;
    })[0];
    const triggers = [];
    const panels = [];
    items.forEach((item) => {
      const panel = panelFor(item);
      if (!panel) return;
      const trigger = collect(item, (candidate) => {
        if (candidate === item || candidate === panel) return false;
        if (closestAncestor(candidate, (node) => node === panel)) return false;
        const text = clampText(textOf(candidate, 200), 160);
        return text.length >= 2 && text.length <= 160;
      }).sort((left, right) => textOf(left, 200).length - textOf(right, 200).length)[0];
      if (!trigger) return;
      triggers.push({ item, trigger, panel });
      panels.push(panel);
    });
    if (triggers.length < 3 || triggers.length < items.length - 1) return;
    const marker = `ink-inferred-accordion-${++index}`;
    triggers.forEach(({ item, trigger, panel }) => {
      addClass(item, "ink-inferred-accordion-item", `${marker}-item`);
      addClass(trigger, "ink-inferred-accordion-question", `${marker}-question`);
      addClass(panel, "ink-inferred-accordion-content", `${marker}-content`);
      settingsOf(item).role = settingsOf(item).role || "accordion-item";
    });
    accordion.type = "timeline-accordion";
    Object.assign(settingsOf(accordion), { behavior: settingsOf(accordion).behavior || "single", defaultOpen: 0, transitionDuration: 280 });
    css.push(
      `.ink-canvas-root .${marker}-content{display:none}`,
      `.ink-canvas-root .${marker}-item.is-open .${marker}-content{display:block!important;position:relative!important;top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;height:auto!important;opacity:1!important;transform:none!important}`,
      `.ink-canvas-root .${marker}-content *{opacity:1!important}`,
      `.ink-canvas-root .${marker}-item{overflow:hidden}`,
    );
    markComponent(accordion, "accordion", { items: triggers.length }, report);
  });
}

// Semantic section roles. They power the navigator, the AI's structural reasoning and the import
// report, and they are derived from tag, geometry, copy and structure — never from a site name.
function detectSectionRoles(roots, ctx) {
  const { evidence, report } = ctx;
  const candidates = collect({ children: roots }, (node) => {
    const tag = tagOf(node);
    if (["nav", "header", "footer"].includes(tag)) return true;
    const rect = evidenceRect(evidence, node);
    if (!rect) return tag === "section";
    return rect.width >= evidence.width * 0.7 && rect.height >= 160;
  });
  // Keep page bands, not every nested box: a role belongs to the outermost region that owns it,
  // and geometry-free wrappers are not regions at all.
  const set = new Set(candidates);
  const ordered = candidates.filter((node) => {
    if (!evidenceRect(evidence, node)) return false;
    let ancestor = node.__inkParent || null;
    while (ancestor) { if (set.has(ancestor)) return false; ancestor = ancestor.__inkParent || null; }
    return true;
  }).sort((left, right) => (evidenceRect(evidence, left)?.y || 0) - (evidenceRect(evidence, right)?.y || 0));
  const roles = {};
  ordered.forEach((node, position) => {
    const tag = tagOf(node);
    const rect = evidenceRect(evidence, node);
    const text = textOf(node, 3000);
    const slugText = `${framerNameOf(node)} ${attributesOf(node)["data-framer-name"] || ""} ${classListOf(node).join(" ")}`;
    const headings = collect(node, (candidate) => /^h[1-3]$/.test(tagOf(candidate))).length;
    const links = collect(node, (candidate) => tagOf(candidate) === "a").length;
    const hasForm = collect(node, (candidate) => tagOf(candidate) === "form" || tagOf(candidate) === "input").length > 0;
    const cardCount = collect(node, (candidate) => settingsOf(candidate).inferredComponent?.kind === "card-grid").length;
    let role = "content";
    if (tag === "nav" || tag === "header" || /(^|\s)(nav|header)/i.test(slugText)) role = "nav";
    else if (tag === "footer" || /footer/i.test(slugText)) role = "footer";
    else if (hasForm) role = "form";
    else if (PRICE_PATTERN.test(text) && PRICE_CYCLE_PATTERN.test(text)) role = "pricing";
    else if (/\b(testimonial|reviews?|what .* say|trusted by)\b/i.test(text) || collect(node, (candidate) => tagOf(candidate) === "blockquote").length >= 2) role = "testimonials";
    else if (/\b(faq|frequently asked|questions?)\b/i.test(text) || settingsOf(node).inferredComponent?.kind === "accordion") role = "faq";
    else if (collect(node, (candidate) => tagOf(candidate) === "a" && isArticleLink(attributesOf(candidate).href)).length >= 3) role = "blog";
    else if (position === 0 && headings && rect && rect.height > 320) role = "hero";
    else if (cardCount || (headings >= 2 && rect && rect.height > 320)) role = "features";
    else if (links <= 3 && headings && rect && rect.height < 420) role = "cta";
    const nodeSettings = settingsOf(node);
    if (!nodeSettings.role) nodeSettings.role = role;
    if (!nodeSettings.label && NAV_ROLE_LABELS[role] && role !== "content") nodeSettings.label = `${NAV_ROLE_LABELS[role]}`;
    if (!nodeSettings.defaultRole) nodeSettings.defaultRole = true;
    roles[role] = (roles[role] || 0) + 1;
    report.sections.push({ role, label: nodeSettings.label || framerNameOf(node) || role, y: rect?.y ?? null });
  });
  report.roles = roles;
}

// Shared header/footer boundaries. Identity comes from structure and position — a top region that
// carries the navigation, a trailing region with link columns and a legal row — with framework
// naming used only as an extra hint, never as the rule.
// Link columns are whatever the site used for them: a <ul> of links, or a stack of divs whose
// each child is a short list of links. Count the widest set of parallel link groups.
function linkColumnCount(node) {
  const direct = childrenOf(node).filter((child) => !/^(script|style)$/.test(tagOf(child)));
  const grouped = direct.filter((child) => tagOf(child) === "a" || collect(child, (candidate) => tagOf(candidate) === "a").length >= 2);
  let best = grouped.length >= 2 ? grouped.length : 0;
  walk(node, (candidate) => {
    if (candidate === node) return;
    const children = childrenOf(candidate).filter((child) => !/^(script|style)$/.test(tagOf(child)));
    if (children.length < 2 || children.length > 8) return;
    const columns = children.filter((child) => tagOf(child) === "a" || collect(child, (grandchild) => tagOf(grandchild) === "a").length >= 2);
    if (columns.length >= 2) best = Math.max(best, columns.length);
  });
  return best;
}

function legalRow(node) {
  const pattern = /(©|copyright|all rights reserved)/i;
  if (pattern.test(textOf(node, 40000))) return true;
  // Some frameworks carry the legal row in layer names rather than text nodes.
  let found = false;
  walk(node, (candidate) => { if (!found && pattern.test(framerNameOf(candidate))) found = true; });
  return found;
}

function isHeaderCandidate(node, evidence) {
  const rect = evidenceRect(evidence, node);
  if (rect && (rect.y > 220 || rect.height > 420 || rect.width < evidence.width * 0.75)) return false;
  if (/^(nav|header)$/.test(tagOf(node))) return true;
  return collect(node, (candidate) => tagOf(candidate) === "nav").length > 0;
}

function isFooterCandidate(node, evidence) {
  const rect = evidenceRect(evidence, node);
  if (rect) {
    if (rect.height < 80 || rect.height > 2400 || rect.width < evidence.width * 0.7) return false;
    if (evidence.documentHeight && rect.y + rect.height < evidence.documentHeight - 60) return false;
  }
  return linkColumnCount(node) >= 2 && legalRow(node);
}

function isSharedSitePart(node, evidence, kind) {
  return kind === "header" ? isHeaderCandidate(node, evidence) : isFooterCandidate(node, evidence);
}

// A shared site part is the single reusable header/footer definition referenced by every imported
// route. The header is the outermost short region that owns the navigation; the footer is the
// tightest trailing region that still carries the link columns and the legal row, so a page-level
// promotional CTA above it is not pulled into the shared component.
function detectSiteParts(roots, ctx) {
  const { evidence, report } = ctx;
  const headers = [];
  const footers = [];
  roots.forEach((root) => walk(root, (node, depth) => {
    if (isHeaderCandidate(node, evidence) && !headers.some((entry) => entry.node === node)) headers.push({ node, depth });
    if (isFooterCandidate(node, evidence)) footers.push({ node, depth });
  }));
  const header = headers.sort((left, right) => (evidenceRect(evidence, left.node)?.height || 400) - (evidenceRect(evidence, right.node)?.height || 400))[0];
  const footer = footers.sort((left, right) => right.depth - left.depth)[0];
  [["header", header], ["footer", footer]].forEach(([key, match]) => {
    if (!match) return;
    const node = match.node;
    // Only mark a container: a site part wraps an editable subtree.
    if (!["container", "section", "nav", "footer", "header"].includes(node.type)) return;
    node.type = "site-part";
    const nodeSettings = settingsOf(node);
    nodeSettings.partKey = key;
    nodeSettings.role = key;
    if (!nodeSettings.label) nodeSettings.label = `Global ${key[0].toUpperCase()}${key.slice(1)}`;
    markComponent(node, key === "header" ? "header" : "footer", {}, report);
  });
}

function sitePartKeyFor(node, evidence) {
  if (tagOf(node) === "header" || tagOf(node) === "footer") return tagOf(node);
  if (isHeaderCandidate(node, evidence)) return "header";
  if (isFooterCandidate(node, evidence)) return "footer";
  return null;
}

// ---------------------------------------------------------------------------------------------
// Entry point

function inferPatterns(children, options = {}) {
  const evidence = createEvidence(options.viewports || []);
  const report = { sections: [], components: [], notices: [], roles: {}, counts: {} };
  const css = [];
  const ctx = { evidence, report, css, counters: { nav: 0 } };
  if (!Array.isArray(children) || !children.length) return { report, css: "" };
  linkParents(children);
  detectOrbit3d(children, ctx);
  detectMotion(children, ctx);
  detectStylesheetHover(children, ctx);
  detectSiteParts(children, ctx);
  detectNavigation(children, ctx);
  detectTabs(children, ctx);
  detectPricingToggle(children, ctx);
  detectCardGrid(children, ctx);
  detectContentArchive(children, ctx);
  detectAccordion(children, ctx);
  detectSectionRoles(children, ctx);
  report.counts = report.components.reduce((totals, component) => ({ ...totals, [component.kind]: (totals[component.kind] || 0) + 1 }), {});
  return { report, css: css.join("\n") };
}

module.exports = {
  inferPatterns,
  createEvidence,
  sitePartKeyFor,
  isSharedSitePart,
  detectSiteParts,
  parsePose,
  poseFromMatrix,
  poseToTransform,
  poseSignature,
  signatureOf,
  textOf,
  walk,
  collect,
  inlineStyles,
  classListOf,
  framerNameOf,
  tagOf,
  attributesOf,
};
