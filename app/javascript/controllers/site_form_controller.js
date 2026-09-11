import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["bar", "save", "discard"]

  connect() {
    this.dirty = false
    this.originalValues = this.serializeForm()
    this.hideBar()
  }

  markDirty() {
    const current = this.serializeForm()
    if (current !== this.originalValues) {
      this.dirty = true
      this.showBar()
    } else {
      this.dirty = false
      this.hideBar()
    }
  }

  discard() {
    this.element.reset()
    this.dirty = false
    this.hideBar()
    this.originalValues = this.serializeForm()
  }

  serializeForm() {
    const data = new FormData(this.element)
    const entries = [...data.entries()].filter(([k]) => k !== "authenticity_token")
    return JSON.stringify(entries)
  }

  showBar() {
    this.barTarget.classList.remove("hidden")
  }

  hideBar() {
    this.barTarget.classList.add("hidden")
  }
}
