import { Controller } from "@hotwired/stimulus"
import { createRichText } from "tiptap"

// Classic WYSIWYG writer block. Wraps TipTap (ProseMirror) and serializes the document to JSON
// into a hidden data-field, so it slots into the block editor's structured-content model exactly
// like every other block — the stored value is a strict JSON schema, rendered server-side by
// Blocks::RichTextComponent (no stored HTML is ever executed).
export default class extends Controller {
  static targets = ["editor", "hiddenField", "toolbar"]

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

    this.bindToolbar()

    // Let the surrounding block editor know our serialized value changed.
    this.editorTarget.addEventListener("focusin", () => {
      this.element.dispatchEvent(new CustomEvent("focusin", { bubbles: true }))
    })
  }

  disconnect() {
    this.editor?.destroy()
  }

  bindToolbar() {
    if (!this.hasToolbarTarget) return
    this.toolbarTarget.querySelectorAll("[data-command]").forEach((btn) => {
      const command = btn.dataset.command
      const arg = btn.dataset.arg
      btn.addEventListener("click", (e) => {
        e.preventDefault()
        this.runCommand(command, arg)
      })
    })
  }

  runCommand(command, arg) {
    switch (command) {
      case "toggleLink":
        this.toggleLink()
        break
      default:
        const chain = this.editor.chain().focus()
        if (arg) chain[command]({ level: parseInt(arg, 10) })
        else chain[command]()
        chain.run()
    }
  }

  toggleLink() {
    if (this.editor.isActive("link")) {
      this.editor.chain().focus().unsetLink().run()
      return
    }
    const previous = this.editor.getAttributes("link").href
    const url = window.prompt("Link URL", previous || "")
    if (url === null) return
    const normalized = url.trim() === "" ? null : /^(https?:\/\/|\/)/.test(url.trim()) ? url.trim() : `https://${url.trim()}`
    if (normalized === null) {
      this.editor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else {
      this.editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run()
    }
  }
}
