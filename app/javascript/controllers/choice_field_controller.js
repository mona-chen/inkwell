import { Controller } from "@hotwired/stimulus"

// Segmented control replacing a block's <select>/<checkbox> (heading level, callout tone,
// button style, list ordered). Each button previews its actual rendered result (H1 sized as
// an H1, tone buttons tinted with the tone color). The chosen value is written into a hidden
// data-field input (or a checkbox) so the block editor serializes it exactly as before, and
// the selected button's data-preview-class is applied to a preview target for live feedback.
export default class extends Controller {
  static targets = ["input", "button", "preview"]

  connect() {
    this.render()
  }

  choose(event) {
    event.preventDefault()
    const btn = event.currentTarget
    this.setValue(btn.dataset.value)
    this.render()
    this.inputTarget.dispatchEvent(new Event("change", { bubbles: true }))
  }

  currentValue() {
    return this.inputTarget.type === "checkbox"
      ? String(this.inputTarget.checked)
      : this.inputTarget.value
  }

  setValue(value) {
    if (this.inputTarget.type === "checkbox") this.inputTarget.checked = value === "true"
    else this.inputTarget.value = value
  }

  render() {
    const value = this.currentValue()
    this.buttonTargets.forEach((b) => {
      const selected = b.dataset.value === value
      b.classList.toggle("is-selected", selected)
      if (this.hasPreviewTarget && b.dataset.previewClass) {
        this.previewTarget.classList.toggle(b.dataset.previewClass, selected)
      }
    })
  }
}
