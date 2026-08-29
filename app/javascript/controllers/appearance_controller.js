import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.sync()
  }

  toggle() {
    const current = document.documentElement.getAttribute("data-theme") || "light"
    const next = current === "dark" ? "light" : "dark"
    this.apply(next)
  }

  apply(theme) {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("inkwell-theme", theme)
    // Update the icon
    this.element.querySelectorAll("[data-theme-icon]").forEach(icon => {
      icon.style.display = icon.dataset.themeIcon === theme ? "" : "none"
    })
  }

  sync() {
    const saved = localStorage.getItem("inkwell-theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const theme = saved || (prefersDark ? "dark" : "light")
    this.apply(theme)
  }
}
