import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["all", "item", "count", "submit", "action"]
  connect() { this.refresh() }
  toggleAll() { this.itemTargets.forEach(item => { item.checked = this.allTarget.checked }); this.refresh() }
  refresh() {
    const count = this.itemTargets.filter(item => item.checked).length
    this.countTarget.textContent = count ? `${count} selected on this page` : "Select items to take action"
    this.allTarget.checked = count > 0 && count === this.itemTargets.length
    this.allTarget.indeterminate = count > 0 && count < this.itemTargets.length
    this.submitTarget.disabled = count === 0
    this.itemTargets.forEach(item => item.closest("[data-content-row]")?.classList.toggle("is-selected", item.checked))
  }
  confirm(event) {
    const count = this.itemTargets.filter(item => item.checked).length
    if (!count) { event.preventDefault(); return }
    const action = this.actionTarget.value
    const messages = { publish_original: `Publish the captured original for ${count} selected pages? The original websites will become public; Builder drafts will be kept.`, delete: `Permanently delete ${count} selected items? This cannot be undone.`, trash: `Move ${count} selected items to trash? You can restore them later.`, publish: `Publish ${count} selected items? They will become visible on your site.`, draft: `Unpublish ${count} selected items? They will no longer be visible on your site.` }
    if (messages[action] && !window.confirm(messages[action])) event.preventDefault()
  }
}
