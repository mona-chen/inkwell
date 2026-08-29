import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["menu"]

  connect() {
    this.outsideClick = this.outsideClick.bind(this)
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
    this.menuTarget.classList.add("block")
    document.addEventListener("pointerdown", this.outsideClick, true)
  }

  close() {
    this.menuTarget.classList.add("hidden")
    this.menuTarget.classList.remove("block")
    document.removeEventListener("pointerdown", this.outsideClick, true)
  }

  outsideClick(event) {
    if (!this.element.contains(event.target)) {
      this.close()
    }
  }

  disconnect() {
    document.removeEventListener("pointerdown", this.outsideClick, true)
  }
}
