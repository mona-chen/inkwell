"use strict";

// Unit coverage for the shared article-route convention. Synthetic URLs only: the assertion is
// that a route is judged by its shape, never by a particular website.

const test = require("node:test");
const assert = require("node:assert/strict");
const { isArticleLink } = require("./site-routes");

test("an archive segment followed by a slug is an article route", () => {
  assert.equal(isArticleLink("/blogs/why-we-built-x"), true);
  assert.equal(isArticleLink("https://example.test/posts/hello-world/"), true);
  assert.equal(isArticleLink("https://example.test/news/launch-day"), true);
});

test("an archive index or unrelated path is not an article route", () => {
  assert.equal(isArticleLink("/blogs"), false);
  assert.equal(isArticleLink("/blogs.html"), false);
  assert.equal(isArticleLink("/pricing"), false);
  assert.equal(isArticleLink("/2026/notes"), false);
  assert.equal(isArticleLink(""), false);
  assert.equal(isArticleLink("#anchor"), false);
});

test("relative links resolve against the page that carried them", () => {
  assert.equal(isArticleLink("why-we-built-x", "https://example.test/blogs/"), true);
  assert.equal(isArticleLink("why-we-built-x", "https://example.test/about"), false);
});

const { outOfScopeArticleOrigins } = require("./site-routes");

test("article links to an unauthorized origin are recorded, in-scope and non-article links are not", () => {
  const found = outOfScopeArticleOrigins([
    "https://sibling.example.test/blogs/one",
    "https://sibling.example.test/blogs/two",
    "https://sibling.example.test/about",
    "https://cdn.example.test/logo.svg",
    "/blogs/local-post",
    "mailto:hello@example.test",
  ], { pageUrl: "https://example.test/blogs/", allowedOrigins: [ "https://example.test" ] });

  assert.deepEqual([...found.keys()], [ "https://sibling.example.test" ]);
  assert.deepEqual([...found.get("https://sibling.example.test")], [
    "https://sibling.example.test/blogs/one",
    "https://sibling.example.test/blogs/two",
  ]);
});

test("an already-authorized origin is never reported as out of scope", () => {
  const found = outOfScopeArticleOrigins([ "https://sibling.example.test/blogs/one" ], {
    pageUrl: "https://example.test/",
    allowedOrigins: [ "https://sibling.example.test" ],
  });
  assert.equal(found.size, 0);
});
