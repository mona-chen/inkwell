import { Controller } from "@hotwired/stimulus"

// Media library item details dialog: open/close a native <dialog> showing the
// file's alt/caption edit form and delete action.
export default class extends Controller {
  static targets = ["dialog"]

  open(event) {
    event.preventDefault()
    this.dialogTarget.showModal()
  }

  close(event) {
    event.preventDefault()
    this.dialogTarget.close()
  }

  // Close when clicking the backdrop
  backdropClose(event) {
    if (event.target === this.dialogTarget) this.dialogTarget.close()
  }
}
