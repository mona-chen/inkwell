import { Controller } from "@hotwired/stimulus"

// Lives on a media item inside the picker Turbo Frame. On click, dispatch a bubbling
// CustomEvent carrying the selected url/alt; the media-picker controller on the editor page
// (outside the frame) listens and fills the block.
export default class extends Controller {
  select(event) {
    const el = event.currentTarget
    document.dispatchEvent(new CustomEvent("inkwell:media-select", {
      detail: { url: el.dataset.url, id: el.dataset.id, alt: el.dataset.alt }
    }))
  }
}
