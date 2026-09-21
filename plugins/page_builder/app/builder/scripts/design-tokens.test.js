"use strict";

// Unit coverage for the design-token system. Tokens are the contract between the theme controls, the
// section archetypes, the Copilot and the importer, so every value is validated here.

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_TOKENS, THEME_PRESETS, applyDesignTokens, describeTokens, designCss, ensureDesignCss,
  normalizeTokens, presetNames, presetTokens, themeSettings, tokenVariables, tokensFromPageSettings, tokensFromEvidence,
} = require("./design-tokens");

test("tokens normalize, clamp and reject anything that is not a safe value", () => {
  const tokens = normalizeTokens({
    colors: { accent: "javascript:alert(1)", background: "#0b0c0d", text: "rgb(255,255,255)" },
    typography: { baseSize: 999, scale: -4, headingWeight: 5000, fontFamily: "Inter; } body { display:none", headingFamily: "Georgia,serif" },
    shape: { radius: -10 },
    spacing: { contentWidth: 10, sectionPadding: 9999 },
    motion: { duration: -5, easing: "expression(alert(1))" },
  });
  assert.equal(tokens.colors.accent, DEFAULT_TOKENS.colors.accent, "an unsafe color falls back");
  assert.equal(tokens.colors.background, "#0b0c0d");
  assert.equal(tokens.colors.text, DEFAULT_TOKENS.colors.text, "rgb() is not a token value; only hex is");
  assert.equal(tokens.typography.baseSize, 32);
  assert.equal(tokens.typography.scale, 1.05);
  assert.equal(tokens.typography.headingWeight, 900);
  assert.equal(tokens.typography.fontFamily, DEFAULT_TOKENS.typography.fontFamily, "a stylesheet break-out is rejected");
  assert.equal(tokens.typography.headingFamily, "Georgia,serif");
  assert.equal(tokens.shape.radius, 0);
  assert.equal(tokens.spacing.contentWidth, 640);
  assert.equal(tokens.spacing.sectionPadding, 300);
  assert.equal(tokens.motion.duration, 0);
  assert.equal(tokens.motion.easing, DEFAULT_TOKENS.motion.easing);
  assert.deepEqual(normalizeTokens(null), normalizeTokens({}), "no tokens is the default token set");
});

test("the heading family falls back to the body family and presets are ordinary token sets", () => {
  const tokens = normalizeTokens({ typography: { fontFamily: "Inter,sans-serif" } });
  assert.equal(tokens.typography.headingFamily, "Inter,sans-serif");
  assert.ok(presetNames().length >= 4);
  for (const name of presetNames()) {
    const preset = presetTokens(name);
    assert.deepEqual(preset, normalizeTokens(preset), `${name} must already be normalized`);
    assert.match(preset.colors.background, /^#[0-9a-f]{6}$/);
  }
  assert.equal(presetTokens("nope"), null);
});

test("tokens project onto the page theme the style engine already compiles", () => {
  const tokens = presetTokens("aurora");
  const settings = themeSettings(tokens);
  assert.equal(settings.colors.accent, tokens.colors.accent);
  assert.equal(settings.colors.primary, tokens.colors.accent);
  assert.equal(settings.typography.fontFamily, tokens.typography.fontFamily);
  assert.equal(settings.typography.baseSize, tokens.typography.baseSize);
  assert.equal(settings.spacing.contentWidth, tokens.spacing.contentWidth);
  // Round-tripping a page's settings recovers the tokens the page is actually using.
  const recovered = tokensFromPageSettings({ theme: settings });
  assert.equal(recovered.colors.accent, tokens.colors.accent);
  assert.equal(recovered.typography.baseSize, tokens.typography.baseSize);
  assert.equal(recovered.spacing.contentWidth, tokens.spacing.contentWidth);
});

test("token variables are valid custom properties and include the canvas aliases", () => {
  const variables = tokenVariables(presetTokens("mono"));
  assert.equal(variables["--ink-t-radius"], "2px");
  assert.equal(variables["--ink-content-width"], "1080px");
  assert.ok(variables["--ink-color-accent"]);
  for (const [name, value] of Object.entries(variables)) {
    assert.match(name, /^--ink-[a-z0-9-]+$/, `${name} must be a custom property`);
    assert.ok(!/[{};]/.test(value), `${name} must not break out of a declaration`);
  }
  const css = designCss(presetTokens("warm"));
  assert.match(css, /^:root\{--ink-t-bg:#fff7f0;/);
  assert.match(css, /\.ink-canvas-root \.ink-arch-section\{/);
  assert.match(css, /\.ink-canvas-root \.ink-arch-grid\{/);
  assert.match(css, /\.ink-canvas-root \.ink-arch-button\{/);
  assert.match(css, /@media\(max-width:991px\)/);
  assert.ok(describeTokens(presetTokens("warm")).includes("#d97757"));
});

test("the design language is read out of captured evidence, not out of a site name", () => {
  const viewport = {
    viewport: { width: 1440, height: 900 },
    bodyStyle: { background: "rgb(11, 12, 13) none repeat scroll 0% 0% / auto padding-box border-box", color: "rgb(0, 0, 0)", fontFamily: "sans-serif", fontSize: "12px", lineHeight: "normal" },
    nodes: [
      { tag: "div", rect: { x: 0, y: 0, width: 1440, height: 4000 }, style: { background: "rgb(11, 12, 13) none repeat", color: "rgb(255, 255, 255)", fontFamily: "Inter, sans-serif", fontSize: "16px" }, text: "" },
      { tag: "h1", rect: { x: 0, y: 0, width: 900, height: 200 }, style: { color: "rgb(255, 255, 255)", fontFamily: '"Gambarino", "Gambarino Placeholder", serif', fontSize: "64px", fontWeight: "400", letterSpacing: "-1.92px" }, text: "Support engage retain" },
      { tag: "p", rect: { x: 0, y: 200, width: 600, height: 60 }, style: { color: "rgba(255, 255, 255, 0.7)", fontFamily: "Inter, sans-serif", fontSize: "16px" }, text: "A sentence of body copy." },
      { tag: "a", rect: { x: 0, y: 260, width: 200, height: 40 }, style: { color: "#0000ee", fontFamily: "Inter, sans-serif", fontSize: "16px" }, text: "Read more" },
      { tag: "button", rect: { x: 0, y: 300, width: 200, height: 48 }, style: { background: "rgb(202, 219, 138)", color: "rgb(11, 12, 13)", borderRadius: "12px", fontSize: "16px", fontFamily: "Inter, sans-serif" }, text: "Start", attributes: { role: "button" } },
      { tag: "div", rect: { x: 0, y: 400, width: 1120, height: 300 }, style: { background: "rgb(40, 43, 43)", borderRadius: "12px" }, text: "" },
    ],
  };
  const tokens = tokensFromEvidence([viewport]);
  assert.equal(tokens.colors.background, "#0b0c0d", "the darkest painted area is the page background");
  assert.equal(tokens.colors.text, "#ffffff", "the UA link blue is not the text color");
  assert.notEqual(tokens.colors.muted, "#0000ee");
  assert.equal(tokens.colors.accent, "#cadb8a", "a brand fill, not the browser's default link color");
  assert.equal(tokens.typography.fontFamily, "Inter,sans-serif", "Framer's placeholder font is stripped");
  assert.equal(tokens.typography.headingFamily, "Gambarino,serif");
  assert.equal(tokens.typography.baseSize, 16, "the body default of 12px is not the body text size");
  assert.equal(tokens.typography.headingWeight, 400);
  assert.equal(tokens.typography.headingTracking, -0.03);
  assert.equal(tokens.shape.radius, 12);
  assert.equal(tokensFromEvidence([]).colors.background, DEFAULT_TOKENS.colors.background, "no evidence keeps the default");
});

test("the design system installs once, and a token edit wins over a stale imported block", () => {
  const tokens = presetTokens("aurora");
  const imported = ":root{--ink-t-bg:#0b0c0d;--ink-t-accent:#cadb8a}\n.ink-imported{color:red}";
  const installed = ensureDesignCss(imported, tokens);
  assert.equal(installed.slice(-imported.length), imported, "the imported stylesheet is preserved verbatim");
  assert.equal(installed.split(".ink-arch-section").length - 1, 1, "the vocabulary is installed exactly once");
  assert.equal(ensureDesignCss(installed, tokens), installed, "installing twice is a no-op");
  assert.ok(installed.indexOf("--ink-t-surface") > 0, "the token variables come with it");
  assert.ok(/--ink-t-accent:#7dd3fc/.test(installed), "sections added to an imported page keep its own palette");
});

test("applying tokens is history-aware and rewrites every token block", () => {
  const writes = [];
  const customCode = {
    css: ":root{--ink-t-bg:#0b0c0d}\n" + designCss(presetTokens("aurora")) + "\n.ink-mine{color:red}",
    getCss() { return this.css; },
    getJs() { return ""; },
    update(css) { this.css = css; },
  };
  const warm = presetTokens("warm");
  const commits = [];
  const runtime = { updateDocumentSettings(patch, label) { commits.push([patch, label]); } };
  applyDesignTokens({ runtime, customCode }, warm, { commit: (css, js, label) => { writes.push(label); customCode.update(css); } });
  assert.equal(commits.length, 1, "the page theme is written");
  assert.equal(commits[0][0].backgroundColor, warm.colors.background);
  assert.equal(commits[0][0].theme.typography.fontFamily.split(",")[0], "Inter");
  assert.equal(commits[0][0].theme.colors.accent, warm.colors.accent);
  assert.deepEqual(writes, ["Apply design tokens"]);
  assert.equal(customCode.getCss().split("--ink-t-bg:#0b0c0d").length - 1, 0, "no stale token block survives");
  assert.equal(customCode.getCss().split(`--ink-t-bg:${warm.colors.background}`).length - 1, 2, "every token block carries the new background");
  assert.equal(customCode.getCss().split("--ink-t-accent:" + warm.colors.accent).length - 1, 2);
  assert.ok(customCode.getCss().includes(".ink-mine{color:red}"), "authored CSS is untouched");
});
