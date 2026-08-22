#!/usr/bin/env node
// Watch mode: runs webpack --watch and mirrors every rebuild from dist/ to the
// Rails-served public/page_builder_assets location. Exit with Ctrl+C.
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const builderDir = path.resolve(__dirname, "..");
const distDir = path.join(builderDir, "dist");
const repoRoot = path.resolve(builderDir, "../../../..");
const targetDir = path.join(repoRoot, "public", "page_builder_assets");

function copy() {
  const files = ["builder.js", "builder.css"];
  for (const file of files) {
    const source = path.join(distDir, file);
    if (!fs.existsSync(source)) continue;
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(source, path.join(targetDir, file));
  }
  console.log(`[watch] synced ${files.filter((f) => fs.existsSync(path.join(distDir, f))).join(", ")}`);
}

const webpack = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["webpack", "--watch", "--progress"], { stdio: "inherit" });

fs.watch(distDir, { persistent: true }, () => setTimeout(copy, 100));
copy();
webpack.on("exit", (code) => process.exit(code || 0));
