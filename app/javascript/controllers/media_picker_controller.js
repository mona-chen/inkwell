import { Controller } from "@hotwired/stimulus"

// Lives on an image block in the editor. "Choose from media library" opens a native dialog
// whose Turbo Frame loads the admin media picker; clicking an item dispatches a bubbling
// CustomEvent that fills the block's url field + preview and closes the dialog.
export default class extends Controller {
  static targets = ["urlField", "altField", "preview", "dialog", "frame"]

  connect() {
    this._onSelect = (event) => this.select(event)
    document.addEventListener("inkwell:media-select", this._onSelect)
  }

  disconnect() {
    document.removeEventListener("inkwell:media-select", this._onSelect)
  }

  open(event) {
    event.preventDefault()
    this.frameTarget.src = this.frameTarget.dataset.src
    this.dialogTarget.showModal()
  }

  close(event) {
    event.preventDefault()
    this.dialogTarget.close()
  }

  // Clear the selection (e.g. remove featured image)
  clear(event) {
    event.preventDefault()
    this.urlFieldTarget.value = ""
    this.urlFieldTarget.dispatchEvent(new Event("input", { bubbles: true }))
    this.previewTarget.innerHTML = '<span class="text-gray-400 text-xs">None</span>'
  }

  // Close when clicking the dialog backdrop (outside the panel)
  backdropClose(event) {
    if (event.target === this.dialogTarget) this.dialogTarget.close()
  }

  // Called from a picker item (in the Turbo Frame). Dispatch a bubbling CustomEvent so the
  // picker on the editor page receives it regardless of frame boundaries.
  pick(event) {
    const el = event.currentTarget
    document.dispatchEvent(new CustomEvent("inkwell:media-select", {
      detail: { url: el.dataset.url, alt: el.dataset.alt }
    }))
  }

  select(event) {
    const { url, id, alt, frame } = event.detail || {}
    if (!url) return
    // Ignore selections made in another picker dialog (image blocks etc).
    if (frame && this.hasFrameTarget && frame !== this.frameTarget.id) return
    // Logo/attachment fields store the media id; image-block url fields store the URL.
    const wantsId = this.urlFieldTarget.name === "settings[site_logo]" || this.urlFieldTarget.name === "post[featured_image_id]"
    this.urlFieldTarget.value = wantsId ? (id || "") : url
    this.urlFieldTarget.dispatchEvent(new Event("input", { bubbles: true })) // triggers block-editor#serialize
    if (this.altFieldTarget && alt) {
      this.altFieldTarget.value = alt
      this.altFieldTarget.dispatchEvent(new Event("input", { bubbles: true }))
    }
    this.previewTarget.innerHTML = url
      ? `<img src="${url}" class="w-full h-full object-contain" alt="">`
      : `<span class="text-gray-400 text-xs">No image</span>`
    this.dialogTarget?.close()
  }
}
