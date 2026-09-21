"use strict";

// One route convention, shared by the capture (deciding which out-of-scope origins carry the
// site's articles) and the mapper (deciding which links are post cards). Keeping it in one place
// means discovery and structure inference can never disagree about what an article URL is.

const ARCHIVE_SEGMENT = /^(blog|blogs|post|posts|article|articles|news|insights?|stories)$/i;

// An article URL has an archive segment followed by a slug, so "…/blogs/why-we-built-x" is a post
// while "…/blogs.html" is only the index.
function isArticleLink(href, base = "https://ink.invalid/") {
  try {
    const segments = new URL(String(href || ""), base).pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    const index = segments.findIndex((segment) => ARCHIVE_SEGMENT.test(segment));
    return index >= 0 && index < segments.length - 1;
  } catch (_) { return false; }
}


// Origins a page links to for its articles but which are outside the authorized set. The capture
// records these rather than following them — it must never crawl a host it was not told about —
// so the caller can decide, with its own safety checks, whether to adopt them and crawl again.
// Only article-shaped routes count, so a page linking to a CDN or a social profile is not a hint
// to import that host.
function outOfScopeArticleOrigins(links, { pageUrl, allowedOrigins = [] } = {}) {
  const allowed = new Set(allowedOrigins);
  const found = new Map();
  (links || []).forEach((link) => {
    let url;
    try { url = new URL(link, pageUrl); } catch (_) { return; }
    if (!/^https?:$/.test(url.protocol) || allowed.has(url.origin) || !isArticleLink(url.href)) return;
    const entry = found.get(url.origin) || new Set();
    if (entry.size < 500) entry.add(url.href);
    found.set(url.origin, entry);
  });
  return found;
}

module.exports = { ARCHIVE_SEGMENT, isArticleLink, outOfScopeArticleOrigins };
