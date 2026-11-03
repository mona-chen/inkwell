// Keep navigation inside an administrator's static-theme preview, including
// links replaced by client-side hydration. Published themes never load this.
const script = document.querySelector("script[data-ink-theme-preview]")
if (script) {
  const slug = script.dataset.inkThemePreview
  const routes = new Set(JSON.parse(script.dataset.routes))
  const rewrite = anchor => {
    const href = anchor.getAttribute("href")
    if (!href || href.startsWith("#")) return
    const url = new URL(href, location.href)
    if (url.origin !== location.origin || !routes.has(url.pathname)) return
    url.searchParams.set("preview_theme", slug)
    anchor.href = url.href
  }
  document.querySelectorAll("a[href]").forEach(rewrite)
  for (const event of ["click", "auxclick"]) document.addEventListener(event, event => {
    const anchor = event.target.closest?.("a[href]")
    if (anchor) rewrite(anchor)
  }, true)
}
