import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  copy(event) {
    const value = event.currentTarget.dataset.clipboardValue || event.currentTarget.textContent
    navigator.clipboard.writeText(value).then(() => {
      const original = event.currentTarget.textContent
      event.currentTarget.textContent = "Copied!"
      setTimeout(() => {
        event.currentTarget.textContent = original
      }, 1500)
    })
  }
}
