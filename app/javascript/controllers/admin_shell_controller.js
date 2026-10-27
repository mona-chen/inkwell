import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel", "overlay"]

  connect() {
    this.desktop = window.matchMedia("(min-width: 1024px)")
    this.onResize = () => {
      if (this.desktop.matches) this.close()
      this.panelTarget.inert = !this.desktop.matches && !this.isOpen
    }
    this.onResize()
    this.onKey = (event) => {
      if (!this.isOpen || event.key !== "Tab") return
      const nodes = [...this.panelTarget.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')].filter(node => node.getClientRects().length)
      const first = nodes[0], last = nodes.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    this.desktop.addEventListener("change", this.onResize)
    this.element.addEventListener("keydown", this.onKey)
  }

  open() {
    this.previousFocus = this.element.querySelector("[aria-controls='admin-navigation']") || document.activeElement
    this.isOpen = true
    this.panelTarget.inert = false
    this.panelTarget.classList.remove("-translate-x-full")
    this.overlayTarget.classList.remove("hidden")
    this.panelTarget.setAttribute("role", "dialog")
    this.panelTarget.setAttribute("aria-modal", "true")
    this.panelTarget.setAttribute("aria-label", "Workspace navigation")
    this.background = this.panelTarget.nextElementSibling
    if (this.background) this.background.inert = true
    document.body.classList.add("overflow-hidden")
    this.updateTrigger(true)
    this.panelTarget.querySelector("button,a")?.focus()
  }

  close() {
    if (!this.isOpen) return
    this.isOpen = false
    this.panelTarget.inert = !this.desktop.matches
    this.panelTarget.classList.add("-translate-x-full")
    this.overlayTarget.classList.add("hidden")
    this.panelTarget.removeAttribute("role")
    this.panelTarget.removeAttribute("aria-modal")
    if (this.background) this.background.inert = false
    document.body.classList.remove("overflow-hidden")
    this.updateTrigger(false)
    if (this.previousFocus?.getClientRects().length) this.previousFocus.focus()
    else if (this.desktop.matches) this.panelTarget.querySelector("a")?.focus()
  }

  disconnect() {
    this.close()
    this.desktop?.removeEventListener("change", this.onResize)
    this.element.removeEventListener("keydown", this.onKey)
  }

  updateTrigger(expanded) {
    const trigger = this.element.querySelector("[aria-controls='admin-navigation']")
    if (trigger) trigger.setAttribute("aria-expanded", expanded.toString())
  }
}
