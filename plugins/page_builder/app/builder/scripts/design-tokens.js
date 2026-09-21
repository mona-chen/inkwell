"use strict";

// The design system is authored once, in `src/core/designTokens.js`, and shared with the browser
// bundle. This is a synchronous CommonJS bridge so the importer reads the SAME token vocabulary
// instead of keeping a second copy that can drift out of step with the builder.
const fs = require("fs");
const path = require("path");

// The easing grammar is authored once in `src/core/easing.js` and imported by the token module, so
// the bridge resolves that one import the same mechanical way instead of keeping a second copy of
// the pattern here. Anything else with an import would fail loudly below.
const easingSource = fs.readFileSync(path.join(__dirname, "../src/core/easing.js"), "utf8");
const easingLoaded = {};
new Function("exports", `${easingSource.replace(/^export const /gm, "const ").replace(/^export function /gm, "function ")}
exports.EASING_CSS_PATTERN = EASING_CSS_PATTERN;`)(easingLoaded);

const source = fs.readFileSync(path.join(__dirname, "../src/core/designTokens.js"), "utf8");
const imports = [...source.matchAll(/^import \{ ([^}]+) \} from '\.\/([\w.-]+)';$/gm)];
const unsupported = imports.filter((match) => match[2] !== "easing.js");
if (unsupported.length) throw new Error(`design-tokens bridge cannot resolve: ${unsupported.map((match) => match[2]).join(", ")}`);
// The module is pure data plus pure functions: rewriting the export forms and handing the one
// imported binding in as a parameter is therefore a complete, mechanical transform.
const body = `${source.replace(/^import .*$/gm, "").replace(/^export const /gm, "const ").replace(/^export function /gm, "function ")}
module.exports = { DEFAULT_TOKENS, THEME_PRESETS, presetNames, presetTokens, normalizeTokens, themeSettings, tokensFromPageSettings, tokensFromEvidence, tokenVariables, ARCHETYPE_CSS, SECTION_CSS, COMPONENT_CSS, designCss, tokenCssBlock, ensureDesignCss, applyDesignTokens, describeTokens };`;

const loaded = { exports: {} };
new Function("module", "exports", "EASING_CSS_PATTERN", body)(loaded, loaded.exports, easingLoaded.EASING_CSS_PATTERN);
module.exports = loaded.exports;
