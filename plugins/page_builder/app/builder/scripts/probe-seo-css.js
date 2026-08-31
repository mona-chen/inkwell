#!/usr/bin/env node
"use strict";
const http = require("http");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const CDP_PORT = Number(process.env.CDP_PORT || 9236);
const EMAIL = process.env.ADMIN_EMAIL || "admin@inkwell.test";
const PASSWORD = process.env.ADMIN_PASSWORD || "password123";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (url) => new Promise((res, rej) => { http.get(url, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res(JSON.parse(b))); }).on("error", rej); });
function cdp(url) { const s = new WebSocket(url); const p = new Map(); let seq = 0; s.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } }; const open = new Promise((r, j) => { s.onopen = r; s.onerror = () => j(new Error("cdp")); }); const send = (method, params = {}) => new Promise((r) => { const id = ++seq; p.set(id, r); s.send(JSON.stringify({ id, method, params })); }); const evaluate = async (ex) => { const r = await send("Runtime.evaluate", { expression: ex, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return { __error: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text }; return r.result.result.value; }; return { open, send, evaluate, close: () => s.close() }; }
(async () => {
  const chromeBin = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "inkwell-css-probe-"));
  const chrome = spawn(chromeBin, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  try {
    await wait(2500);
    const tabs = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
    const client = cdp(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
    await client.open;
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Page.navigate", { url: `${BASE_URL}/users/sign_in` });
    await wait(2500);
    await client.evaluate(`(function(){var e=document.querySelector('input[name="user[email]"]');if(!e)return false;e.value=${JSON.stringify(EMAIL)};document.querySelector('input[name="user[password]"]').value=${JSON.stringify(PASSWORD)};document.querySelector('form').submit();return true;})()`);
    await wait(2500);
    await client.send("Page.navigate", { url: `${BASE_URL}/admin/pages` });
    await wait(4000);
    const info = await client.evaluate(`(function(){
      var html = document.documentElement.outerHTML;
      var hasSepPreview = html.includes('ink-sep-preview');
      var hasSerpTitle = html.includes('ink-serp-title');
      var hasSeoScore = html.includes('ink-seo-score');
      var styleTags = document.querySelectorAll('style');
      var styleCount = styleTags.length;
      var seoStyle = Array.from(styleTags).find(function(s) { return s.textContent.includes('ink-sep-preview'); });
      return { hasSepPreview: hasSepPreview, hasSerpTitle: hasSerpTitle, hasSeoScore: hasSeoScore, styleCount: styleCount, seoStylePresent: !!seoStyle };
    })()`);
    console.log(JSON.stringify(info, null, 2));
    await client.close();
  } finally { chrome.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });
