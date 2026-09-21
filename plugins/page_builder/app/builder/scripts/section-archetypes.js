"use strict";

// CommonJS bridge to the archetype module, mirroring `scripts/design-tokens.js`. The archetypes are
// authored once in `src/core` (ESM, shipped in the browser bundle); tests and any future
// importer-side composition read the same source instead of a drifting copy.
const fs = require("fs");
const path = require("path");
const tokens = require("./design-tokens");

const source = fs.readFileSync(path.join(__dirname, "../src/core/sectionArchetypes.js"), "utf8");
const body = `${source
    .replace(/^import \{[^}]*\} from '\.\/designTokens\.js';$/m, "")
    .replace(/^export const /gm, "const ")
    .replace(/^export function /gm, "function ")
    .replace(/^export \{ PRICING_CSS, DEFAULT_CONTENT \};?$/m, "")}
module.exports = { ARCHETYPES, ARCHETYPE_NAMES, listArchetypes, archetype, archetypeName, buildSection, composePage, sectionClass, PRICING_CSS, DEFAULT_CONTENT, DEFAULT_TOKENS };`;

const loaded = { exports: {} };
new Function("module", "exports", "DEFAULT_TOKENS", "designCss", "normalizeTokens", "COMPONENT_CSS", body)(
    loaded, loaded.exports, tokens.DEFAULT_TOKENS, tokens.designCss, tokens.normalizeTokens, tokens.COMPONENT_CSS,
);
module.exports = loaded.exports;
