"use strict";

// The design system is authored once, in `src/core/designTokens.js`, and shared with the browser
// bundle. This is a synchronous CommonJS bridge so the importer reads the SAME token vocabulary
// instead of keeping a second copy that can drift out of step with the builder.
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "../src/core/designTokens.js"), "utf8");
// The module is pure data plus pure functions: no imports, no default export. Rewriting the two
// export forms is therefore a complete, mechanical transform.
const body = `${source.replace(/^export const /gm, "const ").replace(/^export function /gm, "function ")}
module.exports = { DEFAULT_TOKENS, THEME_PRESETS, presetNames, presetTokens, normalizeTokens, themeSettings, tokensFromPageSettings, tokensFromEvidence, tokenVariables, ARCHETYPE_CSS, SECTION_CSS, COMPONENT_CSS, designCss, tokenCssBlock, ensureDesignCss, applyDesignTokens, describeTokens };`;

const loaded = { exports: {} };
new Function("module", "exports", body)(loaded, loaded.exports);
module.exports = loaded.exports;
