"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const chrome = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const run = (args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { cwd: __dirname, env: process.env });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  child.on("error", reject);
  child.on("close", (code) => resolve({ code, output }));
});

test("empty captures fail with route diagnostics instead of successful output", { skip: !fs.existsSync(chrome), timeout: 30000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ink-empty-capture-"));
  const server = http.createServer((_request, response) => { response.writeHead(404, { "Content-Type": "text/html" }); response.end("Not found"); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/`;
    const result = await run(["capture-site.js", url, "--confirm-ownership", "--max-pages", "1", "--output", root]);
    assert.notEqual(result.code, 0);
    assert.match(result.output, /No pages could be captured/);
    assert.match(result.output, /HTTP 404/);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json")));
    assert.equal(manifest.pages.length, 0);
    assert.equal(manifest.failures[0].url, url);
    const mapped = await run(["map-site-capture.js", root]);
    assert.notEqual(mapped.code, 0);
    assert.match(mapped.output, /Capture contains no pages/);
    assert.equal(fs.existsSync(path.join(root, "site-builder-payload.json")), false);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("pages with persistent background requests remain capturable", { skip: !fs.existsSync(chrome), timeout: 60000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ink-busy-capture-"));
  const server = http.createServer((request, response) => {
    if (request.url.startsWith("/pending")) return; // Simulate analytics/stream connections.
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end('<!doctype html><html><head><title>Busy site</title></head><body><main><h1>Rendered content</h1></main><script>for(let i=0;i<3;i++)fetch("/pending?"+i);</script></body></html>');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/`;
    const result = await run(["capture-site.js", url, "--confirm-ownership", "--max-pages", "1", "--depth", "0", "--output", root]);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /Network remained busy/);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json")));
    assert.equal(manifest.pages.length, 1);
    const page = JSON.parse(fs.readFileSync(path.join(root, manifest.pages[0].manifest)));
    assert.equal(page.viewports.length, 3);
    assert.match(fs.readFileSync(path.join(root, "pages", manifest.pages[0].key, "source.html"), "utf8"), /Rendered content/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("captures sitemap-only routes even when navigation links omit them", { skip: !fs.existsSync(chrome), timeout: 60000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ink-sitemap-capture-"));
  const server = http.createServer((request, response) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (request.url === "/robots.txt") {
      response.writeHead(200, { "Content-Type": "text/plain" });
      return response.end(`Sitemap: ${origin}/sitemap.xml`);
    }
    if (request.url === "/sitemap.xml") {
      response.writeHead(200, { "Content-Type": "application/xml" });
      return response.end(`<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/voice</loc></url><url><loc>${origin}/legal/privacy</loc></url></urlset>`);
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(`<!doctype html><html><head><title>Fixture ${request.url}</title></head><body><main><h1>Page ${request.url}</h1><p>This route has no navigation links.</p></main></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const result = await run(["capture-site.js", `${origin}/`, "--confirm-ownership", "--max-pages", "10", "--depth", "2", "--output", root]);
    assert.equal(result.code, 0, result.output);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json")));
    assert.deepEqual(manifest.pages.map((page) => new URL(page.url).pathname), ["/", "/voice", "/legal/privacy"]);
    assert.equal(manifest.sitemapDiscovery.urls.length, 3);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
