import { Controller } from "@hotwired/stimulus"

// Lives on an image block in the editor. "Choose from media library" opens a Turbo Frame
// dialog pulling in the admin media grid; clicking "Use" on an item calls back here via a
// custom event (dispatched from the media grid item) to fill in the block's url field and
// its own thumbnail preview, then closes the dialog.
export default class extends Controller {
  static targets = ["urlField", "preview", "dialog"]

  open(event) {
    event.preventDefault()
    if (!this.dialogTarget) return
    this.dialogTarget.showModal()
  }

  select(event) {
    const url = event.currentTarget.dataset.url
    this.urlFieldTarget.value = url
    this.urlFieldTarget.dispatchEvent(new Event("input", { bubbles: true })) // triggers block-editor#serialize
    this.previewTarget.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`
    this.dialogTarget?.close()
  }
}
