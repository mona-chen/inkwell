#!/usr/bin/env node
"use strict";

// Evidence-first website capture for the Ink Builder importer. It does not turn an external
// website into an iframe and it never executes captured scripts in the editor. The bundle keeps
// raw source, same-origin assets, multi-viewport screenshots, computed layout, and motion data so
// a later mapper can reconstruct native Ink elements and use a sandbox only for unsupported code.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
// puppeteer-core v25+ is ESM-only; loaded via dynamic import inside the async main block below

const args = process.argv.slice(2);
const valueAfter = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
const source = args.find((value) => /^https?:\/\//i.test(value));
const ownershipConfirmed = args.includes("--confirm-ownership");
const output = path.resolve(valueAfter("--output") || path.join(process.cwd(), "site-captures", new URL(source || "https://invalid.test").hostname));
const maxDepth = Math.max(0, Number.parseInt(valueAfter("--depth") || "6", 10));
const maxPages = Math.max(1, Number.parseInt(valueAfter("--max-pages") || "80", 10));
const chrome = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

if (!source) throw new Error("Usage: npm run capture-site -- https://example.com --confirm-ownership [--output path]");
if (!ownershipConfirmed) throw new Error("Capture requires --confirm-ownership. Import only a site you own or are authorized to reproduce.");
const sourceUrl = new URL(source);
if (!/^https?:$/.test(sourceUrl.protocol)) throw new Error("Only http(s) sites can be captured.");

const viewports = [
  { name: "desktop", width: 1440, height: 1000, deviceScaleFactor: 1 },
  { name: "tablet", width: 768, height: 1024, deviceScaleFactor: 1 },
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: 1 },
];
const safeMkdir = (directory) => fs.mkdirSync(directory, { recursive: true });
const extensionFor = (contentType, url) => {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).slice(0, 8);
  if (ext) return ext;
  if (/css/.test(contentType)) return ".css";
  if (/javascript/.test(contentType)) return ".js";
  if (/svg/.test(contentType)) return ".svg";
  if (/png/.test(contentType)) return ".png";
  if (/jpe?g/.test(contentType)) return ".jpg";
  if (/webp/.test(contentType)) return ".webp";
  if (/woff2/.test(contentType)) return ".woff2";
  return ".bin";
};
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);

async function inspect(page) {
  return page.evaluate(() => {
    const number = (value) => Number.parseFloat(value) || 0;
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.x + scrollX), y: Math.round(rect.y + scrollY), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    const computed = (element) => {
      const style = getComputedStyle(element);
      const keys = ["display", "position", "flexDirection", "flexWrap", "justifyContent", "alignItems", "gridTemplateColumns", "gap", "width", "maxWidth", "minHeight", "padding", "margin", "overflow", "background", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "border", "borderRadius", "boxShadow", "transform", "opacity"];
      return Object.fromEntries(keys.map((key) => [key, style[key]]));
    };
    const semantic = [...document.querySelectorAll("header,main > section,main > article,main > div,body > section,body > footer,footer")];
    const framerRegions = [...document.querySelectorAll("[data-framer-name]")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > innerWidth * .68 && rect.height > 80 && rect.height < innerHeight * 3.5;
    });
    const seenRegions = new Set();
    const candidates = [...semantic, ...framerRegions]
      .filter((element) => { const rect = element.getBoundingClientRect(); const key = [Math.round(rect.top + scrollY), Math.round(rect.width), Math.round(rect.height)].join(":"); if (seenRegions.has(key)) return false; seenRegions.add(key); return rect.width > innerWidth * .45 && rect.height > 40; })
      .sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top)
      .slice(0, 240);
    const sections = candidates.map((element, index) => ({
      index,
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      classes: [...element.classList].slice(0, 20),
      framerName: element.getAttribute("data-framer-name"),
      rect: rectOf(element),
      style: computed(element),
      text: (element.innerText || "").replace(/\s+/g, " ").trim().slice(0, 1200),
      headings: [...element.querySelectorAll("h1,h2,h3,h4,h5,h6")].slice(0, 12).map((heading) => ({ tag: heading.tagName.toLowerCase(), text: heading.textContent.trim(), rect: rectOf(heading), style: computed(heading) })),
      media: [...element.querySelectorAll("img,video,canvas,svg")].slice(0, 24).map((media) => ({ tag: media.tagName.toLowerCase(), src: media.currentSrc || media.src || null, alt: media.alt || null, rect: rectOf(media) })),
    }));
    const animations = document.getAnimations().slice(0, 500).map((animation) => {
      const target = animation.effect && animation.effect.target;
      let frames = [];
      try { frames = animation.effect.getKeyframes().slice(0, 20); } catch (_) {}
      return {
        target: target ? { tag: target.tagName.toLowerCase(), id: target.id || null, classes: [...target.classList].slice(0, 10), framerName: target.getAttribute("data-framer-name") } : null,
        timing: animation.effect && animation.effect.getTiming ? animation.effect.getTiming() : null,
        playState: animation.playState,
        frames,
      };
    });
    const visibleElements = [...document.body.querySelectorAll("*")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }).slice(0, 3000);
    const visibleIndex = new Map(visibleElements.map((element, index) => [element, index]));
    const nodes = visibleElements.map((element, index) => {
      let parent = element.parentElement;
      while (parent && !visibleIndex.has(parent)) parent = parent.parentElement;
      return {
        index,
        parent: parent ? visibleIndex.get(parent) : null,
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        classes: [...element.classList].slice(0, 16),
        framerName: element.getAttribute("data-framer-name"),
        rect: rectOf(element),
        style: computed(element),
        text: element.children.length < 2 ? (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 360) : "",
        attributes: Object.fromEntries([...element.attributes].filter((attribute) => /^(href|src|alt|role|aria-|data-framer)/.test(attribute.name)).slice(0, 16).map((attribute) => [attribute.name, attribute.value.slice(0, 500)])),
      };
    });
    return {
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
      document: { width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) },
      bodyStyle: computed(document.body),
      sections,
      nodes,
      animations,
      fonts: [...document.fonts].map((font) => ({ family: font.family, style: font.style, weight: font.weight, status: font.status })).slice(0, 120),
      stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href),
      scripts: [...document.scripts].map((script) => ({ src: script.src || null, type: script.type || "text/javascript", inlineCharacters: script.src ? 0 : script.textContent.length })),
      technology: { framerNodes: document.querySelectorAll("[data-framer-name]").length, canvas: document.querySelectorAll("canvas").length, video: document.querySelectorAll("video").length },
      links: [...new Set([...document.querySelectorAll("a[href]")].map((link) => link.href).filter(Boolean))],
    };
  });
}

(async () => {
  const puppeteer = (await import("puppeteer-core")).default;
  safeMkdir(output);
  safeMkdir(path.join(output, "assets"));
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-first-run", "--disable-background-networking", "--no-sandbox"] });
  const capturedAssets = new Map();
  const sitePages = [];
  const failures = [];
  const normalizePageUrl = (value) => {
    try {
      const url = new URL(value, sourceUrl);
      if (url.origin !== sourceUrl.origin || !/^https?:$/.test(url.protocol)) return null;
      url.hash = "";
      [...url.searchParams.keys()].forEach((key) => { if (/^(utm_|fbclid|gclid|ref$)/i.test(key)) url.searchParams.delete(key); });
      if (/\/index\.html$/i.test(url.pathname)) url.pathname = url.pathname.replace(/index\.html$/i, "");
      if (/\.(?:css|js|mjs|json|xml|txt|pdf|zip|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|mp4|webm|mov|mp3|wav)$/i.test(url.pathname)) return null;
      if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
      return url.href;
    } catch (_) { return null; }
  };
  const pageKey = (urlValue) => {
    const url = new URL(urlValue);
    const readable = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "home";
    return `${readable.slice(0, 80)}-${digest(url.href).slice(0, 8)}`;
  };
  const capturePage = async (pageUrl, pageDirectory) => {
    safeMkdir(pageDirectory);
    const reports = [];
    let originalHtml = "";
    let renderedHtml = "";
    let discoveredLinks = [];
    for (const viewport of viewports) {
      const page = await browser.newPage();
      await page.setViewport(viewport);
      page.on("response", async (response) => {
        const url = response.url();
        const contentType = response.headers()["content-type"] || "";
        if (new URL(url).origin !== sourceUrl.origin || !/(css|javascript|image|font|svg|json)/i.test(contentType) || capturedAssets.has(url)) return;
        try {
          const buffer = await response.buffer();
          if (!buffer.length || buffer.length > 15_000_000) return;
          const filename = `${digest(url)}${extensionFor(contentType, url)}`;
          fs.writeFileSync(path.join(output, "assets", filename), buffer);
          capturedAssets.set(url, { url, file: `assets/${filename}`, contentType, bytes: buffer.length, status: response.status() });
        } catch (_) {}
      });
      await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 90_000 });
      await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
      await new Promise((resolve) => setTimeout(resolve, 1800));
      if (!originalHtml) {
        originalHtml = await page.evaluate(async () => { const response = await fetch(location.href, { credentials: "include" }); return response.text(); });
        renderedHtml = await page.content();
      }
      const report = await inspect(page);
      if (viewport.name === "desktop") discoveredLinks = report.links || [];
      await page.screenshot({ path: path.join(pageDirectory, `${viewport.name}.png`), fullPage: true });
      reports.push(report);
      await page.close();
    }
    fs.writeFileSync(path.join(pageDirectory, "source.html"), originalHtml);
    fs.writeFileSync(path.join(pageDirectory, "rendered.html"), renderedHtml);
    const manifest = {
      format: "ink-site-capture-v1",
      source: pageUrl,
      capturedAt: new Date().toISOString(),
      ownershipConfirmed: true,
      executionPolicy: "Captured JavaScript is evidence only and must not execute in the editor without explicit review.",
      viewports: reports,
      assets: [...capturedAssets.values()],
    };
    fs.writeFileSync(path.join(pageDirectory, "manifest.json"), JSON.stringify(manifest, null, 2));
    return { manifest, discoveredLinks };
  };
  try {
    const queue = [{ url: normalizePageUrl(sourceUrl.href), depth: 0, parent: null }];
    const queued = new Set(queue.map((item) => item.url));
    while (queue.length && sitePages.length < maxPages) {
      const item = queue.shift();
      const key = pageKey(item.url);
      const pageDirectory = path.join(output, "pages", key);
      try {
        const result = await capturePage(item.url, pageDirectory);
        const desktop = result.manifest.viewports.find((viewport) => viewport.viewport.width >= 1000) || result.manifest.viewports[0];
        sitePages.push({ key, url: item.url, title: desktop.title, depth: item.depth, parent: item.parent, manifest: `pages/${key}/manifest.json`, document: desktop.document, technology: desktop.technology });
        if (item.depth < maxDepth) {
          result.discoveredLinks.map(normalizePageUrl).filter(Boolean).forEach((url) => {
            if (queued.has(url) || sitePages.some((page) => page.url === url) || queue.length + sitePages.length >= maxPages) return;
            queued.add(url); queue.push({ url, depth: item.depth + 1, parent: item.url });
          });
        }
      } catch (error) {
        failures.push({ url: item.url, depth: item.depth, error: error.message });
      }
    }
  } finally {
    await browser.close();
  }
  const manifest = {
    format: "ink-site-capture-v2",
    source: sourceUrl.href,
    capturedAt: new Date().toISOString(),
    ownershipConfirmed: true,
    crawl: { maxDepth, maxPages, capturedPages: sitePages.length, failedPages: failures.length },
    executionPolicy: "Captured JavaScript is evidence only and must not execute in the editor without explicit review.",
    pages: sitePages,
    failures,
    assets: [...capturedAssets.values()],
  };
  fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ ok: true, output, pages: sitePages.length, failures: failures.length, maxDepth, maxPages, assets: capturedAssets.size }, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
