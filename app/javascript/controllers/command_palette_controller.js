import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["trigger", "panel", "input", "destination", "results"]

  connect() {
    this.visibleDestinations = []
  }

  shortcut(event) {
    if (event.defaultPrevented || event.repeat || event.isComposing) return
    if (event.altKey || event.shiftKey) return
    if (event.key !== "k") return
    if (!event.metaKey && !event.ctrlKey) return

    event.preventDefault()
    if (this.panelTarget.classList.contains("hidden")) {
      this.open()
    } else {
      this.close()
    }
  }

  open() {
    this.panelTarget.classList.remove("hidden")
    this.reset()
    this.inputTarget.focus()
    document.addEventListener("keydown", this.boundEscape = (e) => {
      if (e.key === "Escape") this.close()
    }, { once: true })
  }

  close() {
    this.panelTarget.classList.add("hidden")
    this.inputTarget.value = ""
    document.removeEventListener("keydown", this.boundEscape)
    if (this.triggerTarget?.isConnected) this.triggerTarget.focus()
  }

  outsideClick(event) {
    if (event.target === this.panelTarget) this.close()
  }

  select() {
    this.panelTarget.classList.add("hidden")
  }

  filter() {
    const query = this.inputTarget.value.trim().toLocaleLowerCase()

    this.destinationTargets.forEach((dest) => {
      const text = dest.textContent.toLocaleLowerCase()
      dest.style.display = text.includes(query) ? "" : "none"
    })

    this.updateEmptyState()
  }

  navigate(event) {
    const destinations = this.visibleDestinationEls

    if (event.key === "Enter") {
      event.preventDefault()
      if (destinations.length > 0) destinations[0].click()
      return
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (destinations.length === 0) return
      if (event.key === "ArrowDown") {
        destinations[0].focus()
      } else {
        destinations.at(-1).focus()
      }
    }
  }

  reset() {
    this.destinationTargets.forEach(d => d.style.display = "")
    this.updateEmptyState()
  }

  updateEmptyState() {
    const visible = this.visibleDestinationEls
    const empty = this.element.querySelector(".ink-command-empty")
    if (empty) empty.classList.toggle("hidden", visible.length !== 0)
  }

  get visibleDestinationEls() {
    return this.destinationTargets.filter(d => d.style.display !== "none")
  }
}
