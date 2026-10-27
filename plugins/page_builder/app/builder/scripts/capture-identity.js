"use strict";
const crypto = require("crypto");
const parse5 = require("parse5");

function sourceFingerprint(source, rendered) {
  // Cloudflare rotates email-obfuscation keys on each response. Keep rendered
  // text in the identity so an SPA can expose distinct routes from one shell.
  const normalized = source.replace(/(email-protection#|data-cfemail=["'])[a-f0-9]+/gi, "$1EMAIL");
  const text = (node) => {
    if (["script", "style", "noscript", "template"].includes(node.tagName)) return "";
    if (node.nodeName === "#text") return node.value;
    return (node.childNodes || []).map(text).join(" ");
  };
  const renderedText = text(parse5.parse(rendered)).replace(/\s+/g, " ").trim();
  return crypto.createHash("sha256").update(normalized).update("\0").update(renderedText).digest("hex");
}
module.exports = { sourceFingerprint };
