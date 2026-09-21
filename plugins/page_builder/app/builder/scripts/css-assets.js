"use strict";

// Re-applies the stylesheets a capture downloaded for a page. Most sites ship their CSS as
// external files, so removing the <link> without re-reading the asset would drop the rules that
// made the page look designed. Only references the capture actually downloaded are inlined; a
// cross-origin or failed stylesheet is skipped rather than faked, so an import never invents CSS.

const fs = require("fs");
const path = require("path");

function capturedStylesheetCss({
  styles = [],
  assets = [],
  assetRoot,
  pageUrl,
  readFile = (file) => fs.readFileSync(file, "utf8"),
  exists = (file) => fs.existsSync(file),
  absolutize = (css) => css,
} = {}) {
  const byUrl = new Map((assets || [])
    .filter((asset) => asset && asset.url && asset.file)
    .map((asset) => [asset.url, asset]));
  return styles.map(({ href, media }) => {
    let url;
    try { url = new URL(href, pageUrl).href; } catch (_) { return null; }
    const asset = byUrl.get(url);
    if (!asset) return null;
    const file = path.join(assetRoot, asset.file);
    if (!exists(file)) return null;
    const content = absolutize(readFile(file), url);
    return media ? `@media ${media} {\n${content}\n}` : content;
  }).filter(Boolean).join("\n\n");
}

module.exports = { capturedStylesheetCss };
