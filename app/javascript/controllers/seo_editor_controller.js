import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { resource: String, recordId: String, analysisUrl: String }
  static targets = ["seoTitle", "metaDescription", "slug", "titleCount", "descriptionCount", "serpTitle", "serpDescription", "serpSlug", "ogTitle", "ogDescription", "ogPreviewTitle", "ogPreviewDescription", "xTitle", "xDescription", "xPreviewTitle", "xPreviewDescription", "tab", "panel", "analysisStatus", "score", "readingScore", "issueCount", "recommendations", "readingRecommendations", "wordCount", "ogImage", "xImage", "ogPreviewImage", "xPreviewImage", "descriptionSource"]

  connect() {
    this.form = this.element.closest("form")
    this.generatedDescription = this.serpDescriptionTarget.textContent.trim()
    this.featuredImage = this.ogPreviewImageTarget.style.backgroundImage
    this._update = () => { this.update(); this.queueAnalysis() }
    this.form?.addEventListener("input", this._update)
    this.form?.addEventListener("change", this._update)
    this.form?.addEventListener("composer:change", this._update)
    this.selectTab("search")
    this.update()
    this.queueAnalysis()
  }

  disconnect() {
    clearTimeout(this.timer)
    this.request?.abort()
    this.form?.removeEventListener("input", this._update)
    this.form?.removeEventListener("change", this._update)
    this.form?.removeEventListener("composer:change", this._update)
  }

  switchTab(event) { this.selectTab(event.currentTarget.dataset.tab) }

  selectTab(key, focus = false) {
    this.tabTargets.forEach(tab => {
      const selected = tab.dataset.tab === key
      tab.setAttribute("aria-selected", String(selected))
      tab.tabIndex = selected ? 0 : -1
      if (selected && focus) tab.focus()
    })
    this.panelTargets.forEach(panel => { panel.hidden = panel.dataset.tab !== key })
  }

  tabKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    const index = this.tabTargets.indexOf(event.currentTarget)
    const next = event.key === "Home" ? 0 : event.key === "End" ? this.tabTargets.length - 1 : (index + (event.key === "ArrowLeft" ? -1 : 1) + this.tabTargets.length) % this.tabTargets.length
    this.selectTab(this.tabTargets[next].dataset.tab, true)
  }

  update() {
    const title = this.seoTitleTarget.value.trim() || this.form?.querySelector(`[name="${this.resourceValue}[title]"]`)?.value.trim() || ""
    const description = this.metaDescriptionTarget.value.trim() || this.form?.querySelector(`[name="${this.resourceValue}[excerpt]"]`)?.value.trim() || this.generatedDescription || ""
    const ogTitle = this.ogTitleTarget.value.trim() || title
    const ogDescription = this.ogDescriptionTarget.value.trim() || description
    this.serpTitleTarget.textContent = title || "Your post title"
    this.serpDescriptionTarget.textContent = description || "Add a description to preview your search appearance."
    this.metaDescriptionTarget.placeholder = description || "Describe what readers will find on this page…"
    this.descriptionSourceTarget.textContent = this.metaDescriptionTarget.value.trim() ? "Using your custom description" : description ? "Using the summary generated from your draft" : "No description yet"
    this.serpSlugTarget.textContent = this.slugTarget.value.trim() || this.slugTarget.placeholder.trim()
    this.ogPreviewTitleTarget.textContent = ogTitle || "Your post title"
    this.ogPreviewDescriptionTarget.textContent = ogDescription
    this.xPreviewTitleTarget.textContent = this.xTitleTarget.value.trim() || ogTitle || "Your post title"
    this.xPreviewDescriptionTarget.textContent = this.xDescriptionTarget.value.trim() || ogDescription
    this.updateCount(this.titleCountTarget, title.length, 60, 30)
    this.updateCount(this.descriptionCountTarget, description.length, 155, 120)
    const featured = this.form?.querySelector('[data-media-picker-target="preview"] img')?.getAttribute("src")
    const og = this.ogImageTarget.value.trim() || featured
    const x = this.xImageTarget.value.trim() || og
    this.setImage(this.ogPreviewImageTarget, og, "Featured image preview")
    this.setImage(this.xPreviewImageTarget, x, "Featured image preview")
  }

  setImage(element, value, placeholder) {
    try {
      const url = value ? new URL(value, location.origin) : null
      const valid = url && ["http:", "https:"].includes(url.protocol)
      element.style.backgroundImage = valid ? `url(${JSON.stringify(url.href)})` : ""
      element.textContent = valid ? "" : placeholder
    } catch { element.style.backgroundImage = ""; element.textContent = placeholder }
  }

  updateCount(target, length, maximum, minimum) {
    target.textContent = `${length}/${maximum}`
    target.classList.remove("good", "warn", "bad")
    target.classList.add(length > maximum ? "bad" : length >= minimum ? "good" : "warn")
  }

  queueAnalysis() {
    clearTimeout(this.timer)
    this.request?.abort()
    this.analysisStatusTarget.textContent = "Updating draft review…"
    this.timer = setTimeout(() => this.analyze(), 350)
  }

  async analyze() {
    this.request = new AbortController()
    const signal = this.request.signal
    const content = {}
    for (const [name, value] of new FormData(this.form)) {
      const prefix = `${this.resourceValue}[`
      if (name.startsWith(prefix) && name.endsWith("]") && !name.endsWith("[]")) content[name.slice(prefix.length, -1)] = value
    }
    try {
      const response = await fetch(this.analysisUrlValue, { method: "POST", signal,
        headers: { "Content-Type": "application/json", "Accept": "application/json", "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "" },
        body: JSON.stringify({ resource: this.resourceValue, record_id: this.recordIdValue, content }) })
      if (!response.ok) throw new Error("Analysis unavailable")
      const data = await response.json()
      if (signal.aborted || !this.element.isConnected) return
      this.generatedDescription = data.generated_description
      this.update()
      this.scoreTarget.textContent = data.score
      this.readingScoreTarget.textContent = `${data.readability} / 100`
      this.issueCountTarget.textContent = `${data.results.filter(item => item.status !== "good").length} to review`
      this.wordCountTarget.textContent = `${data.words} words analyzed`
      this.renderResults(this.recommendationsTarget, data.results)
      this.renderResults(this.readingRecommendationsTarget, data.reading_results)
      this.analysisStatusTarget.textContent = "Review is up to date"
      const summary = this.form.querySelector('[href="#seo-optimization"] .seo-score')
      if (summary) {
        summary.textContent = data.score
        summary.setAttribute("aria-label", `SEO score ${data.score}`)
        summary.style.background = data.score >= 80 ? "var(--success)" : data.score >= 50 ? "var(--warning)" : "var(--destructive)"
        const description = summary.previousElementSibling?.querySelector(".text-xs")
        if (description) description.textContent = `${data.results.filter(item => item.status !== "good").length} SEO items · Readability ${data.readability}`
      }
    } catch (error) {
      if (error.name !== "AbortError") this.analysisStatusTarget.textContent = "Review unavailable · edit a field to retry"
    }
  }

  renderResults(target, results) {
    const order = { problem: 0, improvement: 1, good: 2 }
    target.replaceChildren(...[...results].sort((a, b) => order[a.status] - order[b.status]).map(item => {
      const row = document.createElement("div")
      row.className = `seo-result is-${item.status}`
      const marker = document.createElement("span")
      marker.className = "seo-result-dot"
      marker.setAttribute("aria-hidden", "true")
      const text = document.createElement("div")
      const label = document.createElement("strong")
      label.textContent = item.label
      const message = document.createElement("p")
      message.textContent = item.message
      text.append(label, message)
      row.append(marker, text)
      return row
    }))
  }
}
