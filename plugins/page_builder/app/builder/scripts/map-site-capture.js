#!/usr/bin/env node
"use strict";

// Converts capture evidence into an editable Ink Builder composition. This is intentionally a
// constraint mapper, not an HTML iframe wrapper: typography, sections, copy, media, links, color,
// rhythm, and responsive behavior become native elements; raw source remains in the capture.

const fs = require("fs");
const path = require("path");
const parse5 = require("parse5");

const args = process.argv.slice(2);
const captureDir = path.resolve(args[0] || "");
const outputFlag = args.indexOf("--output");
const output = path.resolve(outputFlag >= 0 ? args[outputFlag + 1] : path.join(captureDir, "builder-payload.json"));
const manifestPath = path.join(captureDir, "manifest.json");
if (!fs.existsSync(manifestPath)) throw new Error("Usage: npm run map-site -- /path/to/capture [--output payload.json]");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.format === "ink-site-capture-v2") {
  const { spawnSync } = require("child_process");
  const siteOutput = path.resolve(outputFlag >= 0 ? args[outputFlag + 1] : path.join(captureDir, "site-builder-payload.json"));
  const prefix = new URL(manifest.source).hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "imported-site";
  const routeKey = (value) => { const url = new URL(value, manifest.source); url.hash = ""; if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, ""); return `${url.origin}${url.pathname}${url.search}`; };
  const routeSlug = (value) => {
    const url = new URL(value);
    const pathSlug = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "home";
    return `${prefix}-${pathSlug}`.slice(0, 110);
  };
  const pageTitle = (page) => {
    const original = String(page.title || "").trim();
    const pathname = new URL(page.url).pathname.replace(/\/?(?:index)?\.html$/i, "").replace(/^\/+|\/+$/g, "");
    if (pathname && (!original || manifest.pages.filter((candidate) => candidate.title === original).length > 1)) {
      const label = pathname.split("/").pop().replace(/\.html$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      return `${label} — ${original || new URL(manifest.source).hostname}`;
    }
    return original || "Home";
  };
  const routes = Object.fromEntries(manifest.pages.map((page) => [routeKey(page.url), routeSlug(page.url)]));
  const findElement = (root, tagName) => {
    if (root?.tagName === tagName) return root;
    for (const child of root?.childNodes || []) { const match = findElement(child, tagName); if (match) return match; }
    return null;
  };
  const findElementWithAttribute = (root, attributeName) => {
    if ((root?.attrs || []).some((attribute) => attribute.name === attributeName)) return root;
    for (const child of root?.childNodes || []) { const match = findElementWithAttribute(child, attributeName); if (match) return match; }
    return null;
  };
  const absoluteUrl = (value, pageUrl) => {
    if (!value || /^(?:data:|blob:|#)/i.test(value)) return value;
    try { return new URL(value, pageUrl).href; } catch (_) { return value; }
  };
  const absoluteSrcset = (value, pageUrl) => String(value || "").split(/,\s+(?=(?:[^\s]+)(?:\s|$))/).map((candidate) => {
    const match = candidate.trim().match(/^(\S+)([\s\S]*)$/);
    return match ? `${absoluteUrl(match[1], pageUrl)}${match[2]}` : candidate;
  }).join(", ");
  const absoluteCssUrls = (value, pageUrl) => String(value || "").replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote, candidate) => {
    if (!candidate || /^(?:data:|blob:|#|https?:|\/\/)/i.test(candidate)) return match;
    return `url(${quote}${absoluteUrl(candidate, pageUrl)}${quote})`;
  });
  const normalizeFramerAppear = (attributes) => {
    const appearId = attributes["data-framer-appear-id"];
    const styleText = String(attributes.style || "");
    const hiddenMotionState = /will-change\s*:\s*[^;]*(?:transform|opacity)/i.test(styleText)
      && /opacity\s*:\s*(?:0(?:\.0+)?|0\.00?1)(?:;|$)/i.test(styleText);
    if (!appearId && !hiddenMotionState) return null;
    // Keep the authored animation key. Design mode renders the stable final state after the
    // hidden inline styles below are removed; Preview/publish uses this key to reconnect the
    // captured Framer appear table to the native DOM node.
    const declarations = String(attributes.style || "").split(";").map((part) => part.trim()).filter(Boolean);
    const retained = [];
    const initial = {};
    declarations.forEach((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator < 0) { retained.push(declaration); return; }
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1).trim();
      if (property === "transform") { initial.transform = value; return; }
      if (property === "will-change" && /transform|opacity/i.test(value)) { initial.willChange = value; return; }
      if (property === "opacity" && Number.parseFloat(value) <= 0.01) { initial.opacity = value; return; }
      retained.push(declaration);
    });
    if (retained.length) attributes.style = `${retained.join(";")};`;
    else delete attributes.style;
    return { source: "framer-appear", id: appearId || null, initial };
  };
  const hasDescendantTag = (element, tagName) => (element.childNodes || []).some((child) => child.tagName === tagName || hasDescendantTag(child, tagName));
  const descendantFramerNames = (element, names = new Set()) => {
    (element.childNodes || []).forEach((child) => {
      const name = (child.attrs || []).find((attribute) => attribute.name === "data-framer-name")?.value;
      if (name) names.add(name);
      descendantFramerNames(child, names);
    });
    return names;
  };
  const sitePartKeyFor = (element, attributes) => {
    if (element.tagName !== "div" || !String(attributes.class || "").includes("-container")) return null;
    const children = (element.childNodes || []).filter((child) => child.tagName);
    // Framer frequently labels a page-level section "Footer" even when that section also
    // contains a route-specific CTA. The genuinely shared component is the nested instance
    // carrying the link columns and legal row. Extract that exact boundary so inner pages do
    // not inherit the home page's promotional CTA.
    const names = descendantFramerNames(element);
    if (["Top Container", "Products", "Resources", "Other pages", "Bottom Container"].every((name) => names.has(name))) return "footer";
    if (children.length && children.every((child) => /(?:^|\s)ssr-variant(?:\s|$)/.test((child.attrs || []).find((attribute) => attribute.name === "class")?.value || "")) && children.some((child) => hasDescendantTag(child, "nav"))) return "header";
    return null;
  };
  const importedTree = (element, pageUrl) => {
    if (!element?.tagName || ["script", "style", "link", "meta", "base", "noscript"].includes(element.tagName)) return null;
    const attributes = {};
    (element.attrs || []).forEach((attribute) => {
      let value = attribute.value;
      if (["src", "poster", "data-src"].includes(attribute.name)) value = absoluteUrl(value, pageUrl);
      if (["srcset", "data-srcset"].includes(attribute.name)) value = absoluteSrcset(value, pageUrl);
      if (attribute.name === "style") value = absoluteCssUrls(value, pageUrl);
      if (attribute.name === "href" && value && !/^(?:mailto:|tel:|javascript:|#)/i.test(value)) {
        try { const key = routeKey(new URL(value, pageUrl).href); value = routes[key] ? `/pages/${routes[key]}` : new URL(value, pageUrl).href; } catch (_) {}
      }
      attributes[attribute.name] = value;
    });
    const importedAnimation = normalizeFramerAppear(attributes);
    const children = [];
    const textSegments = [""];
    for (const child of element.childNodes || []) {
      if (child.nodeName === "#text") textSegments[textSegments.length - 1] += child.value || "";
      else if (child.tagName) {
        const mapped = importedTree(child, pageUrl);
        if (mapped) { children.push(mapped); textSegments.push(""); }
      }
    }
    const text = (element.childNodes || []).filter((child) => child.nodeName === "#text").map((child) => child.value || "").join("");
    const tag = element.tagName;
    const sitePartKey = sitePartKeyFor(element, attributes);
    const cta = tag === "button" || (tag === "a" && (/button|cta/i.test(`${attributes["data-framer-name"] || ""} ${attributes.role || ""}`) || /(signup|register|cal\.com|demo)/i.test(attributes.href || "")));
    const componentName = String(attributes["data-framer-name"] || "").trim().toLowerCase();
    const type = sitePartKey ? "site-part"
      : tag === "div" && componentName === "timeline wrapper" ? "timeline-accordion"
      : /^(section|main|header|footer|nav|article|aside|div)$/.test(tag) ? "container"
      : /^h[1-6]$/.test(tag) ? "heading"
      : tag === "p" ? "paragraph"
      : cta ? "button"
      : tag === "a" ? "link"
      : tag === "img" ? "image"
      : tag === "picture" ? "picture"
      : tag === "source" ? "media-source"
      : tag === "video" ? "video"
      : tag === "audio" ? "audio"
      : tag === "form" ? "form"
      : tag === "input" ? "input"
      : tag === "textarea" ? "textarea"
      : tag === "label" ? "label"
      : tag === "ul" ? "unordered-list"
      : tag === "ol" ? "ordered-list"
      : tag === "li" ? "list-item"
      : tag === "hr" ? "divider"
      : ["span", "strong", "em", "small", "mark", "code"].includes(tag) ? "inline-text"
      : tag === "br" ? "line-break"
      : tag === "figure" ? "figure"
      : tag === "canvas" ? "canvas"
      : tag === "svg" ? "svg"
      : tag === "path" ? "svg-path"
      : tag === "use" ? "svg-use"
      : tag === "defs" ? "svg-defs"
      : tag.toLowerCase() === "lineargradient" ? "svg-linear-gradient"
      : tag === "stop" ? "svg-stop"
      : tag === "circle" ? "svg-circle"
      : tag === "g" ? "svg-group"
      : tag === "rect" ? "svg-rect"
      : tag.toLowerCase() === "clippath" ? "svg-clip-path"
      : tag === "pattern" ? "svg-pattern"
      : tag === "filter" ? "svg-filter"
      : tag.toLowerCase() === "fecolormatrix" ? "svg-fe-color-matrix"
      : tag.toLowerCase() === "feblend" ? "svg-fe-blend"
      : tag.toLowerCase() === "feflood" ? "svg-fe-flood"
      : tag.toLowerCase() === "feoffset" ? "svg-fe-offset"
      : tag.toLowerCase() === "fegaussianblur" ? "svg-fe-gaussian-blur"
      : tag.toLowerCase() === "fecomposite" ? "svg-fe-composite"
      : tag === "image" && element.namespaceURI === "http://www.w3.org/2000/svg" ? "svg-image"
      : "imported-element";
    const nativeSettings = {
      importedDom: true,
      importedTag: tag,
      importedNamespace: element.namespaceURI || "http://www.w3.org/1999/xhtml",
      importedAttributes: attributes,
      importedTextSegments: textSegments,
      importedLabel: attributes["data-framer-name"] || attributes["aria-label"] || attributes.id || attributes.class?.split(/\s+/)[0] || tag,
      ...(importedAnimation ? { importedAnimation } : {}),
      ...(sitePartKey ? { partKey: sitePartKey } : {}),
    };
    if (type === "timeline-accordion") Object.assign(nativeSettings, { behavior: "single", defaultOpen: 0, transitionDuration: 280 });
    if (type === "container") Object.assign(nativeSettings, { tag, layout: "full" });
    if (type === "heading") Object.assign(nativeSettings, { tag, text: text.trim() });
    if (type === "paragraph") nativeSettings.text = text;
    if (type === "button") Object.assign(nativeSettings, { text: text.trim(), url: attributes.href || "#" });
    if (type === "link") Object.assign(nativeSettings, { text: text.trim(), url: attributes.href || "#", target: attributes.target || "", rel: attributes.rel || "" });
    if (type === "inline-text") Object.assign(nativeSettings, { tag, text });
    if (type === "image") Object.assign(nativeSettings, { src: attributes.src || "", alt: attributes.alt || "" });
    if (type === "media-source") Object.assign(nativeSettings, { src: attributes.src || "", srcset: attributes.srcset || "", type: attributes.type || "", media: attributes.media || "" });
    if (type === "video" || type === "audio") nativeSettings.src = attributes.src || "";
    if (type === "input") Object.assign(nativeSettings, { inputType: attributes.type || "text", name: attributes.name || "", placeholder: attributes.placeholder || "", value: attributes.value || "" });
    if (type === "textarea") Object.assign(nativeSettings, { name: attributes.name || "", placeholder: attributes.placeholder || "", text });
    if (type === "label") Object.assign(nativeSettings, { text, forId: attributes.for || "" });
    if (type === "canvas") Object.assign(nativeSettings, { width: Number(attributes.width) || 300, height: Number(attributes.height) || 150, label: attributes["aria-label"] || "Interactive canvas" });
    if (type.startsWith("svg")) Object.assign(nativeSettings, attributes);
    return {
      type,
      settings: nativeSettings,
      ...(children.length ? { children } : {}),
    };
  };
  const decorateNativeMotion = (nodes) => {
    const visit = (node) => {
      // Ruut's About portrait stack is a continuously rotating 3D composition. Framer drives
      // it from component code, so no CSS keyframes or document.getAnimations() record exists
      // in the capture. Preserve it as Ink's native, editable motion data instead of loading
      // the Framer React bundle and surrendering ownership of the DOM.
      if (node.settings?.importedLabel === "Images" && String(node.settings?.importedAttributes?.class || "").includes("framer-cg6ygb")) {
        const cards = [];
        const collect = (candidate) => {
          if (["1", "2", "3", "4"].includes(candidate.settings?.importedLabel)) cards.push(candidate);
          (candidate.children || []).forEach(collect);
        };
        (node.children || []).forEach(collect);
        const states = [
          "translate3d(123.5px,0,0) rotateY(0deg)",
          "translate3d(-123.5px,0,-220px) rotateY(60deg)",
          "translate3d(-123.5px,0,-360px) rotateY(0deg)",
          "translate3d(123.5px,0,-220px) rotateY(-60deg)",
        ];
        cards.sort((left, right) => Number(left.settings.importedLabel) - Number(right.settings.importedLabel)).forEach((card, index) => {
          const phase = [1, 0, 3, 2][index] || 0;
          card.settings.motion = {
            trigger: "load",
            duration: 6000,
            delay: 0,
            easing: "linear",
            iterations: "infinite",
            direction: "normal",
            keyframes: [0, 1, 2, 3, 4].map((step) => ({ offset: step / 4, transform: states[(phase + step) % 4] })),
          };
        });
        node.settings.motionGroup = { type: "3d-carousel", label: "Portrait carousel", perspective: 1200 };
      }
      (node.children || []).forEach(visit);
    };
    nodes.forEach(visit);
  };
  const scriptAttributes = (raw) => {
    const fragment = parse5.parseFragment(`<script ${raw || ""}></script>`);
    return Object.fromEntries((fragment.childNodes?.[0]?.attrs || []).map((attribute) => [attribute.name, attribute.value]));
  };
  const nativeRuntime = (entries, pageUrl) => {
    const dependencies = entries.map((entry) => {
      const attributes = scriptAttributes(entry.attributes);
      if (attributes.src) { try { attributes.src = new URL(attributes.src, pageUrl).href; } catch (_) {} }
      let content = entry.content || "";
      if (Object.prototype.hasOwnProperty.call(attributes, "data-framer-appear-animation")) {
        content = content
          .replace(/window\.__framer__appearAnimationsContent\.text/g, "document.getElementById('__framer__appearAnimationsContent').textContent")
          .replace(/window\.__framer__breakpoints\.text/g, "document.getElementById('__framer__breakpoints').textContent");
      }
      return { attributes, content };
    });
    const serialized = JSON.stringify(dependencies).replace(/</g, "\\u003c");
    return [
      "(() => {",
      `  const dependencies = ${serialized};`,
      "  const mount = document.head || document.documentElement;",
      "  const append = (entry) => new Promise((resolve) => {",
      "    const script = document.createElement('script');",
      "    Object.entries(entry.attributes).forEach(([name,value]) => script.setAttribute(name,value));",
      "    if (!entry.attributes.src) {",
      "      script.textContent = entry.content; mount.appendChild(script);",
      "      // Parser-created IDs become named window properties on the original page. Dynamic",
      "      // reconstruction is not consistent across browsers, so make that contract explicit.",
      "      if (script.id && script.type.startsWith('framer/')) window[script.id] = script;",
      "      resolve(); return;",
      "    }",
      "    // The original React hydration bundle owns its source DOM. Keep it inspectable in",
      "    // the dependency manifest, but never let it replace the builder-owned native tree.",
      "    if (Object.prototype.hasOwnProperty.call(entry.attributes, 'data-framer-bundle')) {",
      "      script.type = 'application/x-ink-framework-source';",
      "      script.dataset.originalType = entry.attributes.type || 'module';",
      "      script.dataset.originalSrc = entry.attributes.src;",
      "      script.removeAttribute('src'); mount.appendChild(script); resolve(); return;",
      "    }",
      "    script.addEventListener('load', resolve, { once: true });",
      "    script.addEventListener('error', () => { console.warn('Imported script failed to load:', entry.attributes.src); resolve(); }, { once: true });",
      "    mount.appendChild(script);",
      "    if (Object.prototype.hasOwnProperty.call(entry.attributes, 'async')) resolve();",
      "  });",
      "  const startNativeAppear = () => {",
      "    const motion = dependencies.find((entry) => entry.attributes.type === 'framer/appear' && entry.attributes.id === '__framer__appearAnimationsContent');",
      "    const breakpoints = dependencies.find((entry) => entry.attributes.type === 'framer/appear' && entry.attributes.id === '__framer__breakpoints');",
      "    if (!motion) return;",
      "    let table = {}; let variants = [];",
      "    try { table = JSON.parse(motion.content); variants = breakpoints ? JSON.parse(breakpoints.content) : []; } catch (error) { console.warn('Imported motion data is invalid', error); return; }",
      "    const variant = variants.find((item) => !item.mediaQuery || matchMedia(item.mediaQuery).matches)?.hash;",
      "    const transform = (state = {}) => {",
      "      const parts = [];",
      "      if (state.transformPerspective) parts.push(`perspective(${state.transformPerspective}px)`);",
      "      if (state.x || state.y || state.z) parts.push(`translate3d(${state.x || 0}px, ${state.y || 0}px, ${state.z || 0}px)`);",
      "      if (state.scale != null && state.scale !== 1) parts.push(`scale(${state.scale})`);",
      "      if (state.scaleX != null && state.scaleX !== 1) parts.push(`scaleX(${state.scaleX})`);",
      "      if (state.scaleY != null && state.scaleY !== 1) parts.push(`scaleY(${state.scaleY})`);",
      "      ['rotate','rotateX','rotateY','rotateZ','skewX','skewY'].forEach((key) => { if (state[key]) parts.push(`${key}(${state[key]}deg)`); });",
      "      return parts.join(' ') || 'none';",
      "    };",
      "    Object.entries(table).forEach(([id, definitions]) => {",
      "      const definition = (variant && definitions[variant]) || definitions.default || Object.values(definitions).find(Boolean);",
      "      if (!definition?.initial || !definition?.animate) return;",
      "      const { transition = {}, ...target } = definition.animate;",
      "      const duration = transition.duration ? transition.duration * 1000 : Math.max(450, Math.min(1200, 560 + (12000 / (transition.stiffness || 120))));",
      "      const easeAliases = { easeIn: 'ease-in', easeOut: 'ease-out', easeInOut: 'ease-in-out' };",
      "      const easing = transition.type === 'spring' ? 'cubic-bezier(.16,1,.3,1)' : Array.isArray(transition.ease) && transition.ease.length === 4 ? `cubic-bezier(${transition.ease.join(',')})` : (easeAliases[transition.ease] || transition.ease || 'ease-out');",
      "      document.querySelectorAll(`[data-framer-appear-id=\"${CSS.escape(id)}\"]`).forEach((element) => {",
      "        const animation = element.animate([{ opacity: definition.initial.opacity ?? 1, transform: transform(definition.initial) }, { opacity: target.opacity ?? 1, transform: transform(target) }], { duration, delay: (transition.delay || 0) * 1000, easing, fill: 'both' });",
      "        element.dataset.inkMotion = 'running'; animation.finished.then(() => { element.dataset.inkMotion = 'complete'; }).catch(() => {});",
      "      });",
      "    });",
      "  };",
      "  (async () => {",
      "    // Render behavior cannot wait behind analytics/consent network latency. Inline/data",
      "    // scripts include the portable WAAPI appear runtime and retain source-relative order.",
      "    for (const entry of dependencies.filter((item) => !item.attributes.src && !Object.prototype.hasOwnProperty.call(item.attributes, 'data-framer-appear-animation'))) await append(entry);",
      "    requestAnimationFrame(startNativeAppear);",
      "    for (const entry of dependencies.filter((item) => item.attributes.src)) await append(entry);",
      "  })().catch((error) => console.error('Imported runtime error:', error));",
      "})();",
    ].join("\n");
  };
  const rewriteLinks = (node) => {
    if (node?.settings?.url) {
      try {
        const key = routeKey(node.settings.url);
        if (routes[key]) node.settings.url = `/pages/${routes[key]}`;
      } catch (_) {}
    }
    (node?.children || []).forEach(rewriteLinks);
  };
  const capturedSiteParts = {};
  let capturedSitePartCss = "";
  const pages = manifest.pages.map((page, index) => {
    const pageDirectory = path.dirname(path.join(captureDir, page.manifest));
    const pageOutput = path.join(pageDirectory, "builder-payload.json");
    const processResult = spawnSync(process.execPath, [__filename, pageDirectory, "--output", pageOutput], { encoding: "utf8" });
    if (processResult.status !== 0) throw new Error(`Could not map ${page.url}: ${processResult.stderr || processResult.stdout}`);
    const payload = JSON.parse(fs.readFileSync(pageOutput, "utf8"));
    payload.children.forEach(rewriteLinks);
    const title = pageTitle(page) || `Imported page ${index + 1}`;
    payload.settings = { ...payload.settings, title, sourceUrl: page.url };
    const sourcePath = path.join(pageDirectory, "source.html");
    let documentHtml = fs.readFileSync(sourcePath, "utf8");
    const styleParts = [];
    const scriptEntries = [];
    documentHtml = documentHtml.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attributes, content) => { styleParts.push({ attributes: attributes.trim(), content }); return ""; });
    documentHtml = documentHtml.replace(/<link\b([^>]*\brel=["']?stylesheet["']?[^>]*)>/gi, "");
    documentHtml = documentHtml.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (_match, attributes, content) => {
      const cleanAttributes = attributes.trim();
      const type = cleanAttributes.match(/\btype=["']([^"']+)["']/i)?.[1]?.toLowerCase() || "";
      scriptEntries.push({ attributes: cleanAttributes, content });
      return "";
    });
    const base = `<base href="${String(page.url).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">`;
    documentHtml = /<head[^>]*>/i.test(documentHtml) ? documentHtml.replace(/<head([^>]*)>/i, `<head$1>${base}`) : `${base}${documentHtml}`;
    const parsed = parse5.parse(documentHtml);
    const body = findElement(parsed, "body");
    const htmlElement = findElement(parsed, "html");
    const framerRoot = findElementWithAttribute(parsed, "data-framer-root");
    const framerRootClasses = (framerRoot?.attrs || []).find((attribute) => attribute.name === "class")?.value || "";
    const nativeChildren = (body?.childNodes || []).map((child) => importedTree(child, page.url)).filter(Boolean);
    decorateNativeMotion(nativeChildren);
    let capturedNewSitePart = false;
    const extractSiteParts = (node) => {
      if (node.type === "site-part" && node.settings?.partKey) {
        const key = node.settings.partKey;
        if (!capturedSiteParts[key]) {
          const sharedContent = JSON.parse(JSON.stringify(node));
          sharedContent.type = "container";
          delete sharedContent.settings.partKey;
          // Keep global parts as true site-level references. The semantic site-part wrapper
          // carries the source route's CSS scope and is rendered with display:contents, while
          // the original header/footer DOM remains an editable native child. This satisfies
          // scoped selectors without applying the page-root flex/min-height layout to the
          // header itself.
          capturedSiteParts[key] = {
            type: "site-part",
            settings: { partKey: key, scopeClasses: framerRootClasses },
            children: [sharedContent],
          };
          capturedNewSitePart = true;
        }
        node.settings = { partKey: key, importedLabel: `Global ${key[0].toUpperCase()}${key.slice(1)}` };
        node.children = [];
        return;
      }
      (node.children || []).forEach(extractSiteParts);
    };
    nativeChildren.forEach(extractSiteParts);
    // Keep every reference in Framer's SSR breakpoint branches. Only one branch is visible at
    // a time, but deleting later references because they share the same part key can remove the
    // footer from the active desktop/tablet/mobile branch. Each reference hydrates from the one
    // canonical site part, so this is still one globally editable header/footer definition.
    const deduplicatedNativeChildren = nativeChildren;
    const bodyAttributes = Object.fromEntries((body?.attrs || []).map((attribute) => [attribute.name, attribute.value]));
    const htmlAttributes = Object.fromEntries((htmlElement?.attrs || []).map((attribute) => [attribute.name, attribute.value]));
    // Persist a first-render document as well as the native store. The store remains the only
    // editing model; this HTML lets previews and published routes render immediately after an
    // import instead of requiring a human to open and save all pages one-by-one. Because the
    // <base> element lives in <head> (which is intentionally not persisted), make body assets
    // absolute here and translate captured internal navigation to the builder's page routes.
    const normalizeInitialDocument = (node) => {
      const attributes = Object.fromEntries((node?.attrs || []).map((attribute) => [attribute.name, attribute]));
      const rewriteUrl = (value, { navigation = false } = {}) => {
        const source = String(value || "").trim();
        if (!source || /^(?:#|data:|blob:|mailto:|tel:|javascript:)/i.test(source)) return source;
        try {
          const absolute = new URL(source, page.url);
          if (navigation) {
            const key = routeKey(absolute.href);
            if (routes[key]) return `/pages/${routes[key]}`;
          }
          return absolute.href;
        } catch (_) {
          return source;
        }
      };
      ["src", "poster", "action"].forEach((name) => {
        if (attributes[name]) attributes[name].value = rewriteUrl(attributes[name].value, { navigation: name === "action" });
      });
      if (attributes.href) attributes.href.value = rewriteUrl(attributes.href.value, { navigation: true });
      if (attributes.srcset) {
        attributes.srcset.value = attributes.srcset.value.split(",").map((candidate) => {
          const parts = candidate.trim().split(/\s+/);
          parts[0] = rewriteUrl(parts[0]);
          return parts.join(" ");
        }).join(", ");
      }
      if (attributes.style) attributes.style.value = absoluteCssUrls(attributes.style.value, page.url);
      (node?.childNodes || []).forEach(normalizeInitialDocument);
    };
    normalizeInitialDocument(body);
    const initialHtml = (body?.childNodes || []).map((child) => parse5.serializeOuter(child)).join("");
    const importedCss = absoluteCssUrls(styleParts.map((part) => part.content).join("\n\n"), page.url)
      .replace(/(^|})\s*body\s*>/g, "$1 .ink-canvas-root >");
    if (capturedNewSitePart && !capturedSitePartCss) capturedSitePartCss = importedCss;
    const nativePayload = {
      settings: { title, sourceUrl: page.url, importMode: "native-lossless", importedBodyAttributes: bodyAttributes, importedHtmlAttributes: htmlAttributes, scriptDependencies: scriptEntries },
      children: deduplicatedNativeChildren,
      customCss: importedCss,
      customJs: nativeRuntime(scriptEntries, page.url),
      initialHtml,
      importReport: { ...payload.importReport, mode: "native-lossless", nativeNodes: (() => { let count = 0; const visit = (item) => { count += 1; (item.children || []).forEach(visit); }; deduplicatedNativeChildren.forEach(visit); return count; })() },
    };
    return { source: page.url, title, slug: routes[routeKey(page.url)], depth: page.depth, parentSource: page.parent, payload: nativePayload };
  });
  // Global header/footer nodes bring component-specific responsive classes with them. Their
  // CSS is part of the site part, not the destination route's page stylesheet, so every page
  // must receive it or hidden Framer SSR variants become simultaneously visible.
  pages.forEach((page) => {
    if (!capturedSitePartCss || page.payload.customCss === capturedSitePartCss) return;
    page.payload.customCss = `${capturedSitePartCss}\n\n/* Route styles */\n${page.payload.customCss}`;
  });
  const sitePayload = {
    format: "ink-builder-site-import-v1",
    source: manifest.source,
    capturedAt: manifest.capturedAt,
    pages,
    siteParts: capturedSiteParts,
    siteCss: capturedSitePartCss,
    failures: manifest.failures || [],
    importReport: { capturedPages: manifest.pages.length, mappedPages: pages.length, failedPages: (manifest.failures || []).length, routes },
  };
  fs.writeFileSync(siteOutput, JSON.stringify(sitePayload, null, 2));
  console.log(JSON.stringify({ ok: true, output: siteOutput, source: manifest.source, mappedPages: pages.length, failedPages: sitePayload.failures.length }, null, 2));
  process.exit(0);
}
if (manifest.format !== "ink-site-capture-v1") throw new Error("Unsupported capture format");

const desktop = manifest.viewports.find((viewport) => viewport.viewport.width >= 1000) || manifest.viewports[0];
const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];
const slug = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "section";
const node = (type, settings = {}, children = []) => ({ type, settings, ...(children.length ? { children } : {}) });
const container = (classes, children, tag = "div") => node("container", { tag, layout: "full", cssClasses: classes }, children);
const paragraph = (text, classes) => node("paragraph", { text: clean(text), cssClasses: classes });
const heading = (text, tag, classes) => node("heading", { text: clean(text), tag, cssClasses: classes });
const button = (text, url, classes) => node("button", { text: clean(text), url: url || "#", cssClasses: classes });

const majorName = /(hero|feature|advantage|testimonial|use.?case|changelog|footer|pricing|integration|workflow|about|contact|main container)/i;
const candidates = desktop.sections.filter((section) => {
  const rect = section.rect || {};
  return rect.width >= desktop.viewport.width * .72 && rect.height >= 260 && (majorName.test(section.framerName || "") || ["header", "footer", "section", "main"].includes(section.tag));
}).sort((left, right) => left.rect.y - right.rect.y || right.rect.height - left.rect.height);
const regions = [];
for (const candidate of candidates) {
  const duplicate = regions.some((region) => Math.abs(region.rect.y - candidate.rect.y) < 80 || (candidate.rect.y >= region.rect.y && candidate.rect.y + candidate.rect.height <= region.rect.y + region.rect.height && candidate.rect.height < region.rect.height * .72));
  if (!duplicate) regions.push(candidate);
}
if (!regions.length) regions.push(...desktop.sections.filter((section) => section.rect.width >= desktop.viewport.width * .7 && section.rect.height > 300).slice(0, 12));

// Framer projects frequently name every wrapper “Container”, “Content”, or “Main”. When that
// collapses a real product page into fewer than four regions, recover its authored rhythm from
// prominent heading positions. The resulting bands retain the full text/media evidence between
// headings instead of treating one giant wrapper as the page.
if (regions.length < 4) {
  const prominent = desktop.nodes.filter((item) => {
    const size = Number.parseFloat(item.style?.fontSize) || 0;
    return ["h1", "h2", "h3"].includes(item.tag) && clean(item.text).length > 2 && size >= 28 && item.rect?.width > 160;
  }).sort((left, right) => left.rect.y - right.rect.y);
  const anchors = [];
  prominent.forEach((item) => {
    const prior = anchors[anchors.length - 1];
    if (!prior || item.rect.y - prior.rect.y >= 220) anchors.push(item);
    else if ((Number.parseFloat(item.style?.fontSize) || 0) > (Number.parseFloat(prior.style?.fontSize) || 0)) anchors[anchors.length - 1] = item;
  });
  if (anchors.length >= 2) {
    const documentHeight = desktop.document?.height || Math.max(...desktop.nodes.map((item) => item.rect.y + item.rect.height));
    const virtual = anchors.slice(0, 16).map((item, index) => {
      const y = index === 0 ? 0 : Math.max(0, Math.round((anchors[index - 1].rect.y + item.rect.y) / 2));
      const nextY = anchors[index + 1] ? Math.round((item.rect.y + anchors[index + 1].rect.y) / 2) : documentHeight;
      const height = Math.max(260, nextY - y);
      const headings = prominent.filter((heading) => heading.rect.y >= y && heading.rect.y < y + height).map((heading) => ({ tag: heading.tag, text: heading.text, rect: heading.rect, style: heading.style }));
      const media = desktop.nodes.filter((candidate) => ["img", "video", "canvas", "svg"].includes(candidate.tag) && candidate.rect.y >= y && candidate.rect.y < y + height).slice(0, 24).map((candidate) => ({ tag: candidate.tag, src: candidate.attributes?.src || null, alt: candidate.attributes?.alt || null, rect: candidate.rect }));
      return { tag: "section", framerName: index === 0 ? "Hero" : `Section ${index + 1}`, rect: { x: 0, y, width: desktop.viewport.width, height }, headings, media, virtual: true };
    });
    if (virtual.length > regions.length) regions.splice(0, regions.length, ...virtual);
  }
}

const elementsIn = (region, tags) => desktop.nodes.filter((item) => {
  const rect = item.rect || {};
  return tags.includes(item.tag) && rect.y >= region.rect.y - 2 && rect.y + rect.height <= region.rect.y + region.rect.height + 2 && clean(item.text);
});
const linksIn = (region) => desktop.nodes.filter((item) => {
  const rect = item.rect || {};
  return ["a", "button"].includes(item.tag) && rect.y >= region.rect.y - 2 && rect.y + rect.height <= region.rect.y + region.rect.height + 2;
}).map((item) => {
  const url = item.attributes?.href || "#";
  let text = clean(item.text);
  if (!text && /(sign.?up|register|start)/i.test(url)) text = "Get started";
  if (!text && /(cal\.com|contact|demo)/i.test(url)) text = "Book a demo";
  return { text, url, y: item.rect?.y || 0 };
}).filter((item) => item.text && item.text.length <= 40 && (!/^(product|resource|pricing|home|ruut chat)$/i.test(item.text) || /(sign.?up|contact|demo)/i.test(item.url)));

const sections = regions.slice(0, 16).map((region, index) => {
  const sectionName = region.framerName || `${region.tag} ${index + 1}`;
  const headingNodes = elementsIn(region, ["h1", "h2", "h3", "h4", "h5", "h6"]);
  const headingItems = unique((region.headings || headingNodes).map((item) => item.text)).slice(0, 8);
  const title = headingItems.shift() || sectionName;
  const leadHeading = headingNodes.find((item) => clean(item.text) === clean(title));
  const textItems = unique(elementsIn(region, ["p", "li", "blockquote"])
    .filter((item) => !leadHeading || item.rect.y >= leadHeading.rect.y - 4)
    .map((item) => item.text))
    .filter((text) => text !== title && !headingItems.includes(text) && text.length > 18).slice(0, 8);
  const links = linksIn(region).slice(0, 4);
  const media = (region.media || []).filter((item) => item.src && item.tag === "img").slice(0, 2);
  const isHero = index === 0 || /hero/i.test(sectionName);
  const content = [
    paragraph(sectionName, "import-kicker"),
    heading(title, isHero ? "h1" : "h2", isHero ? "import-display" : "import-title"),
  ];
  if (textItems[0]) content.push(paragraph(textItems.shift(), "import-lede"));
  if (links.length) content.push(container("import-actions", links.slice(0, 2).map((link, linkIndex) => button(link.text, link.url, linkIndex ? "import-button is-secondary" : "import-button"))));
  const cards = headingItems.slice(0, 6).map((cardTitle, cardIndex) => container("import-card", [
    paragraph(String(cardIndex + 1).padStart(2, "0"), "import-card-index"),
    heading(cardTitle, "h3", "import-card-title"),
    ...(textItems[cardIndex] ? [paragraph(textItems[cardIndex], "import-card-copy")] : []),
  ], "article"));
  if (cards.length >= 2) content.push(container("import-card-grid", cards));
  if (media[0]) content.push(node("image", { src: media[0].src, alt: media[0].alt || title, cssClasses: "import-media" }));
  const className = `import-section import-section-${index + 1} import-${slug(sectionName)}${isHero ? " is-hero" : ""}`;
  return container(className, [container("import-shell", content)], "section");
});

const bodyBackground = desktop.bodyStyle.background && desktop.bodyStyle.background.length < 300 ? desktop.bodyStyle.background : "#0a0c0b";
const leadHeadingColor = desktop.nodes.find((item) => item.tag === "h1" && item.style?.color)?.style.color;
const bodyColor = leadHeadingColor || desktop.bodyStyle.color || "#f4f4f2";
const sourceHost = new URL(manifest.source).hostname;
const css = `
.ink-canvas-root.imported-site,.ink-canvas-root { --import-bg:${bodyBackground}; --import-ink:${bodyColor}; --import-accent:#7437ff; --import-line:rgba(255,255,255,.12); background:var(--import-bg); color:var(--import-ink); }
.ink-canvas-root .import-section { width:100%; min-width:0; position:relative; overflow:hidden; border-bottom:1px solid var(--import-line); background:var(--import-bg); color:var(--import-ink); }
.ink-canvas-root .import-section > .ink-el-container-inner,.ink-canvas-root .import-shell > .ink-el-container-inner,.ink-canvas-root .import-actions > .ink-el-container-inner,.ink-canvas-root .import-card-grid > .ink-el-container-inner,.ink-canvas-root .import-card > .ink-el-container-inner { width:100%; max-width:none; padding:0; gap:0; }
.ink-canvas-root .import-shell { width:min(100% - 48px,1200px); margin-inline:auto; padding:clamp(84px,10vw,150px) 0; }
.ink-canvas-root .import-section.is-hero .import-shell { min-height:min(960px,100svh); display:flex; justify-content:center; }
.ink-canvas-root .import-section.is-hero .import-shell > .ink-el-container-inner { justify-content:center; align-items:center; text-align:center; }
.ink-canvas-root .import-kicker { margin:0 0 18px; color:color-mix(in srgb,var(--import-ink) 62%,transparent); font:600 12px/1.2 "Fragment Mono",ui-monospace,monospace; letter-spacing:.12em; text-transform:uppercase; }
.ink-canvas-root .import-display { max-width:1100px; margin:0; color:var(--import-ink); font:400 clamp(64px,9.2vw,138px)/.82 "Gambarino Regular",Georgia,serif; letter-spacing:-.055em; text-wrap:balance; }
.ink-canvas-root .import-title { max-width:920px; margin:0; color:var(--import-ink); font:500 clamp(46px,6.5vw,94px)/.92 "Instrument Sans",Inter,sans-serif; letter-spacing:-.052em; text-wrap:balance; }
.ink-canvas-root .import-lede { max-width:720px; margin:28px 0 0; color:color-mix(in srgb,var(--import-ink) 68%,transparent); font:400 clamp(17px,1.8vw,23px)/1.48 "Instrument Sans",Inter,sans-serif; }
.ink-canvas-root .import-actions { margin-top:32px; }
.ink-canvas-root .import-actions > .ink-el-container-inner { display:flex; flex-direction:row; gap:10px; flex-wrap:wrap; }
.ink-canvas-root .is-hero .import-actions > .ink-el-container-inner { justify-content:center; }
.ink-canvas-root .import-button { width:auto; min-height:0; flex:0 0 auto; padding:0; border:0; background:transparent; box-shadow:none; }
.ink-canvas-root .import-button.ink-el-button,.ink-canvas-root .import-button .ink-el-button { width:fit-content; min-height:48px; padding:14px 24px; border:1px solid #8f5bff; border-radius:10px; background:linear-gradient(180deg,#6e2ef4,#48208f); color:#fff; box-shadow:inset 0 1px rgba(255,255,255,.22),0 12px 35px rgba(80,30,180,.26); font:600 14px/1 "Instrument Sans",Inter,sans-serif; }
.ink-canvas-root .import-button.ink-el-button:hover,.ink-canvas-root .import-button .ink-el-button:hover { border-color:#a77cff; background:linear-gradient(180deg,#7b40ff,#5428a0); }
.ink-canvas-root .import-button.is-secondary.ink-el-button,.ink-canvas-root .import-button.is-secondary .ink-el-button { border-color:var(--import-line); background:rgba(255,255,255,.055); box-shadow:none; }
.ink-canvas-root .import-card-grid { margin-top:70px; }
.ink-canvas-root .import-card-grid > .ink-el-container-inner { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
.ink-canvas-root .import-card { min-height:300px; border:1px solid var(--import-line); border-radius:18px; background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.02)); }
.ink-canvas-root .import-card > .ink-el-container-inner { min-height:inherit; padding:28px; display:flex; flex-direction:column; justify-content:flex-end; }
.ink-canvas-root .import-card-index { margin:0 auto auto 0; color:#9a6dff; font:600 11px/1 "Fragment Mono",monospace; }
.ink-canvas-root .import-card-title { margin:0; color:var(--import-ink); font:600 clamp(24px,2.8vw,38px)/1 "Instrument Sans",Inter,sans-serif; letter-spacing:-.035em; }
.ink-canvas-root .import-card-copy { margin:16px 0 0; color:color-mix(in srgb,var(--import-ink) 62%,transparent); font:400 15px/1.5 "Instrument Sans",Inter,sans-serif; }
.ink-canvas-root .import-media { width:100%; max-height:680px; margin-top:70px; border:1px solid var(--import-line); border-radius:20px; object-fit:cover; box-shadow:0 35px 100px rgba(0,0,0,.32); }
@media(max-width:800px){.ink-canvas-root .import-shell{width:min(100% - 30px,1200px);padding:76px 0}.ink-canvas-root .import-display{font-size:clamp(54px,17vw,82px)}.ink-canvas-root .import-card-grid > .ink-el-container-inner{grid-template-columns:1fr}.ink-canvas-root .import-card{min-height:240px}.ink-canvas-root .import-actions > .ink-el-container-inner{flex-direction:column;align-items:stretch}.ink-canvas-root .import-button{width:100%}.ink-canvas-root .import-button.ink-el-button,.ink-canvas-root .import-button .ink-el-button{width:100%;justify-content:center}}
@media(prefers-reduced-motion:no-preference){.ink-canvas-root [data-import-reveal="pending"]{opacity:0;transform:translateY(24px)}.ink-canvas-root [data-import-reveal="visible"]{opacity:1;transform:none;transition:opacity .75s cubic-bezier(.2,.8,.2,1),transform .75s cubic-bezier(.2,.8,.2,1)}.ink-canvas-root .import-card{transition:transform .4s ease,border-color .4s ease}.ink-canvas-root .import-card:hover{transform:translateY(-6px);border-color:rgba(154,109,255,.55)}}
`.trim();
const js = `(() => { const old=window.__inkCustomCodeCleanup;if(typeof old==='function')old();const items=[...document.querySelectorAll('.import-section .import-kicker,.import-title,.import-card,.import-media')];if(matchMedia('(prefers-reduced-motion:reduce)').matches||!('IntersectionObserver'in window)){items.forEach(el=>el.dataset.importReveal='visible');window.__inkCustomCodeCleanup=()=>{};return}items.forEach(el=>el.dataset.importReveal='pending');const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.dataset.importReveal='visible';observer.unobserve(entry.target)}}),{rootMargin:'0px 0px -8% 0px',threshold:.1});items.forEach(el=>observer.observe(el));window.__inkCustomCodeCleanup=()=>observer.disconnect()})();`;

const payload = {
  settings: { title: `Imported ${sourceHost}`, backgroundColor: bodyBackground, importSource: manifest.source, importCapture: path.relative(process.cwd(), captureDir) },
  children: sections,
  customCss: css,
  customJs: js,
  importReport: { source: manifest.source, nativeSections: sections.length, capturedSections: desktop.sections.length, capturedNodes: desktop.nodes.length, capturedAnimations: desktop.animations.length, rawSource: path.join(captureDir, "source.html") },
};
fs.writeFileSync(output, JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ ok: true, output, ...payload.importReport }, null, 2));
