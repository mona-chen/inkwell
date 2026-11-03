import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["source"]

  async copy(event) {
    const button = event.currentTarget
    const original = button.textContent
    const source = this.hasSourceTarget ? this.sourceTarget : null
    try {
      await navigator.clipboard.writeText(source?.value ?? (button.dataset.clipboardValue || original))
      button.textContent = "Copied!"
    } catch {
      source?.focus()
      source?.select()
      button.textContent = source ? "Press Ctrl/Cmd+C" : "Copy failed"
    }
    setTimeout(() => { button.textContent = original }, 2500)
  }
}
