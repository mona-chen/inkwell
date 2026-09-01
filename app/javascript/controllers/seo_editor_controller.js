import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "seoTitle", "metaDescription", "slug", "titleCount", "descriptionCount",
    "serpTitle", "serpDescription", "serpSlug", "ogTitle", "ogDescription",
    "ogPreviewTitle", "ogPreviewDescription", "xTitle", "xDescription",
    "xPreviewTitle", "xPreviewDescription"
  ]

  connect() {
    this.update()
  }

  update() {
    const title = this.valueOrPlaceholder(this.seoTitleTarget)
    const description = this.valueOrPlaceholder(this.metaDescriptionTarget)
    const slug = this.valueOrPlaceholder(this.slugTarget)
    const ogTitle = this.ogTitleTarget.value.trim() || title
    const ogDescription = this.ogDescriptionTarget.value.trim() || description
    const xTitle = this.xTitleTarget.value.trim() || ogTitle
    const xDescription = this.xDescriptionTarget.value.trim() || ogDescription

    this.serpTitleTarget.textContent = this.truncate(title, 60)
    this.serpDescriptionTarget.textContent = this.truncate(description, 160)
    this.serpSlugTarget.textContent = slug
    this.ogPreviewTitleTarget.textContent = ogTitle
    this.ogPreviewDescriptionTarget.textContent = ogDescription
    this.xPreviewTitleTarget.textContent = xTitle
    this.xPreviewDescriptionTarget.textContent = xDescription
    this.updateCount(this.titleCountTarget, title.length, 60, 30)
    this.updateCount(this.descriptionCountTarget, description.length, 155, 120)
  }

  valueOrPlaceholder(field) {
    return field.value.trim() || field.placeholder.trim()
  }

  truncate(value, length) {
    return value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value
  }

  updateCount(target, length, maximum, minimum) {
    target.textContent = `${length}/${maximum}`
    target.classList.remove("good", "warn", "bad")
    target.classList.add(length > maximum ? "bad" : length >= minimum ? "good" : "warn")
  }
}
