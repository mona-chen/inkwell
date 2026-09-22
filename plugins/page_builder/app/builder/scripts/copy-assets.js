#!/usr/bin/env node
// Copies the compiled builder assets from dist/ into the Rails-served location
// (public/page_builder_assets) so the builder layout can pick them up without a manual step.
"use strict";
const fs = require("fs");
const path = require("path");

const builderDir = path.resolve(__dirname, "..");
const distDir = path.join(builderDir, "dist");
const repoRoot = path.resolve(builderDir, "../../../..");
const targetDir = path.join(repoRoot, "public", "page_builder_assets");

const files = ["builder.js", "builder.css"];
for (const file of files) {
  const source = path.join(distDir, file);
  if (!fs.existsSync(source)) {
    console.error(`Missing build artifact: ${source} — run npm run build first.`);
    process.exit(1);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(source, path.join(targetDir, file));
}
console.log(`Copied ${files.join(", ")} → ${path.relative(repoRoot, targetDir)}`);

// The design kit is the .cp-* vocabulary and the Material Symbols font published pages link, so the
// Rails-served mirror is part of the build rather than a file someone has to remember to copy.
const designKitSource = path.join(repoRoot, "plugins/page_builder/themes/standard/1_column_layout/ink-design-kit.css");
const themeDir = path.join(repoRoot, "public", "page_builder_theme");
if (fs.existsSync(designKitSource)) {
  fs.mkdirSync(themeDir, { recursive: true });
  fs.copyFileSync(designKitSource, path.join(themeDir, "ink-design-kit.css"));
  console.log(`Copied ink-design-kit.css → ${path.relative(repoRoot, themeDir)}`);
} else {
  console.error(`Missing design kit: ${designKitSource}`);
  process.exit(1);
}
