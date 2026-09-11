import { Controller } from "@hotwired/stimulus"

// Disclosure toggle: shows/hides a target and rotates an optional chevron.
export default class extends Controller {
  static targets = ["menu", "icon"]

  toggle() {
    const hidden = this.menuTarget.classList.toggle("hidden")
    this.iconTargets.forEach((icon) => icon.classList.toggle("is-open", !hidden))
  }
}
