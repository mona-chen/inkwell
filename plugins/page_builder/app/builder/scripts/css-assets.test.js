"use strict";

// Unit coverage for re-applying a captured site's external stylesheets. Fixtures are synthetic:
// the assertion is that inlining is driven by the capture's asset list, never by a website name.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { capturedStylesheetCss } = require("./css-assets");

const options = (overrides = {}) => ({
  assetRoot: "/captures/site",
  pageUrl: "https://example.test/pricing",
  assets: [{ url: "https://example.test/assets.css", file: "assets/abc.css" }],
  readFile: () => ".card-grid{display:grid}",
  exists: () => true,
  absolutize: (css) => css,
  ...overrides,
});

test("a captured external stylesheet is re-applied verbatim", () => {
  const css = capturedStylesheetCss(options({ styles: [{ href: "assets.css", media: null }] }));
  assert.equal(css, ".card-grid{display:grid}");
});

test("a relative href resolves against the page and a media query is preserved", () => {
  const css = capturedStylesheetCss(options({ styles: [{ href: "/assets.css", media: "print" }] }));
  assert.equal(css, "@media print {\n.card-grid{display:grid}\n}");
});

test("stylesheet URLs are absolutized against the stylesheet, not the page", () => {
  let seen = null;
  capturedStylesheetCss(options({
    styles: [{ href: "assets.css", media: null }],
    absolutize: (css, base) => { seen = base; return css; },
  }));
  assert.equal(seen, "https://example.test/assets.css");
});

test("a stylesheet the capture never downloaded is skipped, never faked", () => {
  assert.equal(capturedStylesheetCss(options({ styles: [{ href: "https://fonts.example/x.css" }] })), "");
  assert.equal(capturedStylesheetCss(options({ styles: [{ href: "assets.css" }], exists: () => false })), "");
});

test("several stylesheets keep their cascade order", () => {
  const assets = [
    { url: "https://example.test/a.css", file: "assets/a.css" },
    { url: "https://example.test/b.css", file: "assets/b.css" },
  ];
  const css = capturedStylesheetCss(options({
    assets,
    styles: [{ href: "a.css" }, { href: "b.css" }],
    readFile: (file) => path.basename(file),
  }));
  assert.equal(css, "a.css\n\nb.css");
});
