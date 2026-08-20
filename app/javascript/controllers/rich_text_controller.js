import { Controller } from "@hotwired/stimulus"
import { createRichText } from "tiptap"

// Classic WYSIWYG writer block. Wraps TipTap (ProseMirror) and serializes the document to JSON
// into a hidden data-field, so it slots into the block editor's structured-content model exactly
// like every other block — the stored value is a strict JSON schema, rendered server-side by
// Blocks::RichTextComponent (no stored HTML is ever executed).
export default class extends Controller {
  static targets = ["editor", "hiddenField"]

  connect() {
    const initial = this.hiddenFieldTarget.value
    let json = null
    try { json = initial ? JSON.parse(initial) : null } catch (e) { json = null }

    this.editor = createRichText(this.editorTarget, {
      content: json || "<p></p>",
      onChange: (serialized) => {
        this.hiddenFieldTarget.value = serialized
        // Tell the surrounding block editor to re-serialize the whole block list.
        this.hiddenFieldTarget.dispatchEvent(new Event("change", { bubbles: true }))
      },
    })

    // Let the surrounding block editor know our serialized value changed.
    this.editorTarget.addEventListener("focusin", () => {
      this.element.dispatchEvent(new CustomEvent("focusin", { bubbles: true }))
    })
  }

  disconnect() {
    this.editor?.destroy()
  }
}
