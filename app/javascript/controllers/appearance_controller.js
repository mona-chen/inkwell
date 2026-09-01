import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    const saved = localStorage.getItem("inkwell-theme")
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    this.apply(saved || preferred, false)
  }

  toggle() {
    const current = document.documentElement.getAttribute("data-theme") || "light"
    this.apply(current === "dark" ? "light" : "dark")
  }

  apply(theme, persist = true) {
    document.documentElement.setAttribute("data-theme", theme)
    document.documentElement.style.colorScheme = theme
    if (persist) localStorage.setItem("inkwell-theme", theme)
    this.sync(theme)
  }

  sync(theme) {
    this.element.querySelectorAll("[data-theme-icon]").forEach((icon) => {
      icon.classList.toggle("hidden", icon.dataset.themeIcon !== theme)
    })
  }
}
