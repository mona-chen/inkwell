import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["menu"]

  connect() {
    this.outsideClick = this.outsideClick.bind(this)
    // Style the menu for smooth transitions
    if (this.hasMenuTarget) {
      this.menuTarget.style.transition = "opacity 120ms ease, transform 120ms ease"
    }
  }

  toggle() {
    if (this.menuTarget.classList.contains("hidden")) {
      this.open()
    } else {
      this.close()
    }
  }

  open() {
    this.menuTarget.classList.remove("hidden")
    this.menuTarget.style.opacity = "0"
    this.menuTarget.style.transform = "translateY(-4px)"
    requestAnimationFrame(() => {
      this.menuTarget.style.opacity = "1"
      this.menuTarget.style.transform = "translateY(0)"
    })
    document.addEventListener("pointerdown", this.outsideClick, true)
    this.trigger?.setAttribute("aria-expanded", "true")
  }

  close() {
    if (!this.hasMenuTarget || this.menuTarget.classList.contains("hidden")) return
    this.menuTarget.style.opacity = "0"
    this.menuTarget.style.transform = "translateY(-4px)"
    setTimeout(() => {
      this.menuTarget.classList.add("hidden")
      this.menuTarget.style.opacity = ""
      this.menuTarget.style.transform = ""
    }, 120)
    document.removeEventListener("pointerdown", this.outsideClick, true)
    this.trigger?.setAttribute("aria-expanded", "false")
  }

  outsideClick(event) {
    if (!this.element.contains(event.target)) {
      this.close()
    }
  }

  disconnect() {
    document.removeEventListener("pointerdown", this.outsideClick, true)
  }

  get trigger() {
    return this.element.querySelector("button[aria-haspopup='menu']")
  }
}
