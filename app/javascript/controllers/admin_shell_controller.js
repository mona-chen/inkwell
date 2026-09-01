import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel", "overlay"]

  open() {
    this.panelTarget.classList.remove("-translate-x-full")
    this.overlayTarget.classList.remove("hidden")
    document.body.classList.add("overflow-hidden")
    this.updateTrigger(true)
  }

  close() {
    if (window.matchMedia("(min-width: 1024px)").matches) return

    this.panelTarget.classList.add("-translate-x-full")
    this.overlayTarget.classList.add("hidden")
    document.body.classList.remove("overflow-hidden")
    this.updateTrigger(false)
  }

  disconnect() {
    document.body.classList.remove("overflow-hidden")
  }

  updateTrigger(expanded) {
    const trigger = this.element.querySelector("[aria-controls='admin-navigation']")
    if (trigger) trigger.setAttribute("aria-expanded", expanded.toString())
  }
}
