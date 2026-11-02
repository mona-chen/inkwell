"use strict";

// Optional route evidence, not permission to visit another origin. Parse only XML
// location text: no DTD/entity evaluation, scripts, or arbitrary external requests.
const decodeXml = (value) => String(value).replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, key) => {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  if (key[0] !== "#") return named[key.toLowerCase()] || match;
  const number = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
  return number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : match;
}).trim();

function sitemapEntries(xml) {
  const kind = /<(?:[\w-]+:)?sitemapindex\b/i.test(xml) ? "index" : /<(?:[\w-]+:)?urlset\b/i.test(xml) ? "pages" : null;
  if (!kind) return { kind: null, locations: [] };
  return { kind, locations: [...xml.matchAll(/<(?:[\w-]+:)?loc\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?loc\s*>/gi)].map((match) => decodeXml(match[1])).filter(Boolean) };
}

async function discoverSitemapRoutes({ source, allowedOrigins, maxUrls = 250, fetcher = fetch, budgetMs = 15000 }) {
  const allowed = new Set(allowedOrigins);
  const deadline = Date.now() + budgetMs;
  const urls = new Set(), seen = new Set(), documents = [], errors = [];
  const eligible = (value, base = source) => {
    try {
      if (typeof value !== "string" || !value.trim()) return null;
      const url = new URL(value, base);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || !allowed.has(url.origin)) return null;
      url.hash = "";
      return url.href;
    } catch (_) { return null; }
  };
  const read = async (address) => {
    let url = eligible(address);
    for (let hop = 0; url && hop < 4 && Date.now() < deadline; hop++) {
      const signal = AbortSignal.timeout(Math.max(1, Math.min(4000, deadline - Date.now())));
      const response = await fetcher(url, { redirect: "manual", signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = eligible(response.headers.get("location"), url);
        await response.body?.cancel();
        if (!next) return null;
        url = next;
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); return null; }
      const reader = response.body?.getReader();
      if (!reader) return "";
      const chunks = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2_000_000) throw new Error("Sitemap exceeds 2 MB");
          chunks.push(Buffer.from(value));
        }
      } finally { await reader.cancel().catch(() => {}); }
      return Buffer.concat(chunks).toString("utf8");
    }
    return null;
  };
  for (const origin of allowed) {
    if (Date.now() >= deadline || urls.size >= maxUrls || seen.size >= 12) break;
    const pending = [new URL("/sitemap.xml", origin).href];
    try {
      const robots = await read(new URL("/robots.txt", origin).href);
      for (const match of (robots || "").matchAll(/^\s*sitemap:\s*(\S+)/gim)) {
        const location = eligible(match[1], origin);
        if (location) pending.push(location);
      }
    } catch (error) { errors.push({ url: `${origin}/robots.txt`, error: error.message }); }
    while (pending.length && seen.size < 12 && urls.size < maxUrls && Date.now() < deadline) {
      const address = pending.shift();
      if (seen.has(address)) continue;
      seen.add(address);
      try {
        const xml = await read(address);
        if (!xml) continue;
        const entries = sitemapEntries(xml);
        if (!entries.kind) continue;
        documents.push(address);
        for (const value of entries.locations) {
          const location = eligible(value, address);
          if (!location) continue;
          if (entries.kind === "index") { if (pending.length < 24 && !seen.has(location)) pending.push(location); }
          else { urls.add(location); if (urls.size >= maxUrls) break; }
        }
      } catch (error) { errors.push({ url: address, error: error.message }); }
    }
  }
  return { urls: [...urls], documents, errors };
}

module.exports = { sitemapEntries, discoverSitemapRoutes };
