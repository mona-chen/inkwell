import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.boundSync = () => this.sync()
    window.addEventListener("nitro-kit:appearance-change", this.boundSync)
    this.sync()
  }

  disconnect() {
    window.removeEventListener("nitro-kit:appearance-change", this.boundSync)
  }

  toggle() {
    const current = document.documentElement.getAttribute("data-theme") || "light"
    const next = current === "dark" ? "light" : "dark"
    this.apply(next)
  }

  apply(theme) {
    window.dispatchEvent(new CustomEvent("nitro-kit:appearance-request", {
      detail: { preference: theme }
    }))
  }

  sync() {
    const theme = document.documentElement.getAttribute("data-theme") || "light"
    this.element.querySelectorAll("[data-theme-icon]").forEach(icon => {
      icon.style.display = icon.dataset.themeIcon === theme ? "" : "none"
    })
  }
}
