import { Controller } from "@hotwired/stimulus"

// Lives on a media item inside the picker Turbo Frame. On click, dispatch a bubbling
// CustomEvent carrying the selected url/alt; the media-picker controller on the editor page
// (outside the frame) listens and fills the block.
export default class extends Controller {
  select(event) {
    const el = event.currentTarget
    // The frame id scopes the selection to the picker dialog it happened in, so multiple
    // pickers on the page (image blocks, featured image, logo) never fill each other.
    const detail = {
      url: el.dataset.url,
      id: el.dataset.id,
      alt: el.dataset.alt,
      frame: el.closest("turbo-frame")?.id
    }
    // If running inside the Ink Builder's iframe, post the selection to the parent window.
    if (window.self !== window.top) {
      window.parent.postMessage({ type: "inkwell:media-select", detail }, "*")
      return
    }
    document.dispatchEvent(new CustomEvent("inkwell:media-select", { detail }))
  }
}
