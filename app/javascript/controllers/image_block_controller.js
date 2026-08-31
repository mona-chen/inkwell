import { Controller } from "@hotwired/stimulus"

// Gutenberg-style image block. Three ways to set an image: direct upload (drag-drop or file
// picker, POSTed to the media library), the media-library picker dialog, or a pasted URL.
// Once set, the block shows the image large with Replace/Remove and reveals alt + caption
// fields. The chosen value always lands in a hidden data-field="url" input so the block
// editor serializes it like any other block.
export default class extends Controller {
  static targets = ["url", "alt", "caption", "file", "empty", "populated", "preview", "error", "errorUrl", "dropzone", "dialog", "frame"]

  connect() {
    this._onSelect = (event) => this.select(event)
    document.addEventListener("inkwell:media-select", this._onSelect)
    this.sync()
  }

  disconnect() {
    document.removeEventListener("inkwell:media-select", this._onSelect)
  }

  // Show the populated vs empty state based on whether a url is set.
  sync() {
    const url = this.urlTarget.value.trim()
    this.emptyTarget.classList.toggle("hidden", !!url)
    this.populatedTarget.classList.toggle("hidden", !url)
    if (!url) {
      this.previewTarget.removeAttribute("src")
      this.clearError()
      return
    }

    this.clearError()
    this.previewTarget.alt = this.hasAltTarget ? this.altTarget.value.trim() : ""
    let resolvedUrl
    try {
      resolvedUrl = new URL(url, document.baseURI).href
    } catch (_error) {
      this.failed()
      return
    }
    if (this.previewTarget.src !== resolvedUrl) this.previewTarget.src = url
  }

  loaded() {
    this.clearError()
  }

  failed() {
    this.previewTarget.classList.add("hidden")
    this.errorTarget.classList.remove("hidden")
    this.errorTarget.classList.add("flex")
    if (this.hasErrorUrlTarget) this.errorUrlTarget.textContent = this.urlTarget.value.trim()
  }

  clearError() {
    this.previewTarget.classList.remove("hidden")
    this.errorTarget.classList.add("hidden")
    this.errorTarget.classList.remove("flex")
    if (this.hasErrorUrlTarget) this.errorUrlTarget.textContent = ""
  }

  // ---- media picker dialog --------------------------------------------------

  openPicker(event) {
    event.preventDefault()
    this.frameTarget.src = this.frameTarget.dataset.src
    this.dialogTarget.showModal()
  }

  closePicker(event) {
    event.preventDefault()
    this.dialogTarget.close()
  }

  backdropClose(event) {
    if (event.target === this.dialogTarget) this.dialogTarget.close()
  }

  // A picker item was clicked inside *this* block's dialog frame.
  select(event) {
    const { url, alt, frame } = event.detail || {}
    if (!url || frame !== this.frameTarget.id) return
    this.setUrl(url)
    if (this.hasAltTarget && alt) this.setField(this.altTarget, alt)
    this.sync()
    this.dialogTarget?.close()
  }

  // ---- upload ---------------------------------------------------------------

  pickFile(event) {
    event.preventDefault()
    this.fileTarget.click()
  }

  upload(event) {
    const file = event.target.files?.[0]
    if (file) this.submitUpload(file)
    event.target.value = ""
  }

  dragOver(event) {
    event.preventDefault()
    this.dropzoneTarget.classList.add("dragging")
  }

  dragLeave(event) {
    this.dropzoneTarget.classList.remove("dragging")
  }

  drop(event) {
    event.preventDefault()
    this.dropzoneTarget.classList.remove("dragging")
    const file = event.dataTransfer?.files?.[0]
    if (file) this.submitUpload(file)
  }

  submitUpload(file) {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content
    const form = new FormData()
    form.append("file", file)
    fetch("/admin/media", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf, "Accept": "application/json" },
      body: form
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`upload failed: ${r.status}`))))
      .then((data) => {
        this.setUrl(data.url)
        if (data.alt && this.hasAltTarget) this.setField(this.altTarget, data.alt)
        this.sync()
      })
      .catch(() => {
        // Keep the block in its current state; the upload error is logged on the media page.
      })
  }

  // ---- URL paste / replace / remove -----------------------------------------

  applyUrl(event) {
    const url = event.target.value.trim()
    if (!url) return
    this.setUrl(url)
    this.sync()
  }

  remove(event) {
    event.preventDefault()
    this.setUrl("")
    if (this.hasAltTarget) this.setField(this.altTarget, "")
    if (this.hasCaptionTarget) this.setField(this.captionTarget, "")
    this.sync()
  }

  // ---- helpers --------------------------------------------------------------

  setUrl(url) {
    this.urlTarget.value = url
    this.urlTarget.dispatchEvent(new Event("input", { bubbles: true }))
  }

  setField(target, value) {
    target.value = value
    target.dispatchEvent(new Event("input", { bubbles: true }))
  }
}
