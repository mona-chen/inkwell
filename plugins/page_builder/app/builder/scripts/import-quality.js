"use strict";

// Report only what the mapper can prove. A reconstructed DOM is not a recovered interaction.
function importQuality(nodes, viewports = []) {
  const report = { nativeNodes: 0, containers: 0, maxDepth: 0, nativeMotionNodes: 0, importedDomNodes: 0, unverifiedControls: 0 };
  function visit(node, depth) {
    report.nativeNodes++;
    report.maxDepth = Math.max(report.maxDepth, depth);
    if (node.type === "container") report.containers++;
    if (node.settings?.importedDom) report.importedDomNodes++;
    if (node.settings?.motion) report.nativeMotionNodes++;
    const attrs = node.settings?.importedAttributes || {};
    if (node.settings?.importedTag === "button" || ["button", "tab", "switch", "menuitem"].includes(attrs.role)) report.unverifiedControls++;
    (node.children || []).forEach((child) => visit(child, depth + 1));
  }
  nodes.forEach((node) => visit(node, 1));
  report.observedAnimations = Math.max(0, ...viewports.map((view) => (view.animations || []).length));
  report.behaviorVerified = false;
  return report;
}

function skippedRoutes(manifest, pageManifests) {
  const captured = new Set(manifest.pages.map((page) => canonical(page.url)));
  const allowedOrigins = new Set([new URL(manifest.source).origin, ...(manifest.crawl?.origins || [])]);
  const routes = new Map();
  for (const page of pageManifests) for (const viewport of page.viewports || []) for (const link of viewport.links || []) {
    try {
      const url = new URL(link, page.source);
      if (!/^https?:$/.test(url.protocol) || captured.has(canonical(url.href))) continue;
      const reason = allowedOrigins.has(url.origin) ? "Not captured (check crawl depth, page limit, or failures)" : "Outside the configured website origins";
      routes.set(canonical(url.href), { url: canonical(url.href), reason });
    } catch (_) { /* Non-web links are not page candidates. */ }
  }
  return [...routes.values()];
}

function canonical(value) {
  const url = new URL(value); url.hash = "";
  url.pathname = url.pathname.replace(/\/index\.html$/i, "/");
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}

module.exports = { importQuality, skippedRoutes };
