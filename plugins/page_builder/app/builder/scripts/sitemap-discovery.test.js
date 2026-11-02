"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { sitemapEntries, discoverSitemapRoutes } = require("./sitemap-discovery");

test("parses XML entities, CDATA and namespaced sitemap indexes without external entities", () => {
  assert.deepEqual(sitemapEntries('<urlset><url><loc><![CDATA[https://site.test/a?x=1&y=2]]></loc></url></urlset>').locations, ['https://site.test/a?x=1&y=2']);
  assert.deepEqual(sitemapEntries('<x:sitemapindex><x:sitemap><x:loc>https://site.test/a.xml?x=1&amp;y=2</x:loc></x:sitemap></x:sitemapindex>'), { kind: "index", locations: ['https://site.test/a.xml?x=1&y=2'] });
  assert.equal(sitemapEntries('<html><loc>https://site.test/</loc></html>').kind, null);
});

test("discovers unlinked legal pages through robots and recursive sitemap indexes", async () => {
  const responses = {
    "https://site.test/robots.txt": "User-agent: *\nSitemap: https://site.test/catalog.xml",
    "https://site.test/catalog.xml": '<sitemapindex><sitemap><loc>https://site.test/pages.xml</loc></sitemap><sitemap><loc>https://site.test/catalog.xml</loc></sitemap></sitemapindex>',
    "https://site.test/pages.xml": '<urlset><url><loc>https://site.test/voice</loc></url><url><loc>https://site.test/legal/privacy</loc></url></urlset>'
  };
  const result = await discoverSitemapRoutes({ source: "https://site.test/", allowedOrigins: ["https://site.test"], fetcher: async (url) => new Response(responses[url] || "Missing", { status: responses[url] ? 200 : 404 }) });
  assert.deepEqual(result.urls, ["https://site.test/voice", "https://site.test/legal/privacy"]);
  assert.equal(result.documents.length, 2);
});

test("never follows foreign origins, credentials, or foreign redirects", async () => {
  const fetched = [];
  const result = await discoverSitemapRoutes({ source: "https://site.test/", allowedOrigins: ["https://site.test"], fetcher: async (url) => {
    fetched.push(url);
    if (url.endsWith("robots.txt")) return new Response("Sitemap: http://127.0.0.1/secrets.xml\nSitemap: https://site.test/redirect.xml\nSitemap: https://user:password@site.test/private.xml");
    if (url.endsWith("redirect.xml")) return new Response(null, { status: 302, headers: { Location: "http://169.254.169.254/latest" } });
    return new Response('<urlset><url><loc>https://foreign.test/private</loc></url><url><loc>https://site.test/safe</loc></url></urlset>');
  } });
  assert.deepEqual(result.urls, ["https://site.test/safe"]);
  assert.ok(fetched.every((url) => new URL(url).origin === "https://site.test" && !new URL(url).username));
});

test("respects the route limit and gracefully falls back when no sitemap exists", async () => {
  const limited = await discoverSitemapRoutes({ source: "https://site.test/", allowedOrigins: ["https://site.test"], maxUrls: 1, fetcher: async (url) => new Response(url.endsWith("robots.txt") ? "" : '<urlset><url><loc>https://site.test/one</loc></url><url><loc>https://site.test/two</loc></url></urlset>') });
  assert.deepEqual(limited.urls, ["https://site.test/one"]);
  const absent = await discoverSitemapRoutes({ source: "https://site.test/", allowedOrigins: ["https://site.test"], fetcher: async () => new Response("Not found", { status: 404 }) });
  assert.deepEqual(absent.urls, []);
});
