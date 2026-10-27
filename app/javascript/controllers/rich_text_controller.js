import { placeEditorPopover } from "editor_popover"
import { Controller } from "@hotwired/stimulus"
import { createRichText } from "tiptap"

// Classic WYSIWYG writer block. Wraps TipTap (ProseMirror) and serializes the document to JSON
// into a hidden data-field, so it slots into the block editor's structured-content model exactly
// like every other block — the stored value is a strict JSON schema, rendered server-side by
// Blocks::RichTextComponent (no stored HTML is ever executed).
export default class extends Controller {
  static targets = ["editor", "hiddenField", "toolbar", "linkDialog", "linkUrl", "linkError"]

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

    if (this.element.dataset.editorAutofocus) {
      this.editor.commands.focus("end")
      delete this.element.dataset.editorAutofocus
    }
    this._formattingFocus = () => {
      this.toolbarTarget.classList.add("is-context-active")
      this.positionFormatting()
    }
    this._formattingBlur = () => requestAnimationFrame(() => {
      if (!this.element.contains(document.activeElement)) this.toolbarTarget.classList.remove("is-context-active")
    })
    this._formattingPosition = () => this.positionFormatting()
    this.element.addEventListener("focusin", this._formattingFocus)
    this.element.addEventListener("focusout", this._formattingBlur)
    window.addEventListener("resize", this._formattingPosition)
    window.addEventListener("scroll", this._formattingPosition, true)
    this.bindToolbar()
    this.refreshToolbar()
    this.editor.on("update", () => this.updateSlashCommand())
    this.editor.on("selectionUpdate", () => { this.refreshToolbar(); this.updateSlashCommand() })
    this.editor.on("transaction", () => this.refreshToolbar())

    // Let the surrounding block editor know our serialized value changed.
    this.editorTarget.addEventListener("focusin", () => {
      this.element.dispatchEvent(new CustomEvent("focusin", { bubbles: true }))
    })
    this.editorTarget.addEventListener("keyup", () => this.refreshToolbar())
    this.editorTarget.addEventListener("mouseup", () => this.refreshToolbar())
  }

  updateSlashCommand() {
    const selection = this.editor.state.selection
    const text = selection.$from.parent.textContent
    const command = selection.empty && selection.$from.depth === 1 && /^\/[a-z _-]*$/i.test(text)
    this.element.dispatchEvent(new CustomEvent("composer:slash", { bubbles: true, detail: { query: command ? text.slice(1) : null, index: selection.$from.index(0) } }))
  }

  disconnect() {
    this.element.removeEventListener("focusin", this._formattingFocus)
    this.element.removeEventListener("focusout", this._formattingBlur)
    window.removeEventListener("resize", this._formattingPosition)
    window.removeEventListener("scroll", this._formattingPosition, true)
    this.editor?.destroy()
  }

  positionFormatting() {
    if (!this.hasToolbarTarget || !this.toolbarTarget.classList.contains("is-context-active")) return
    let anchor = this.editorTarget.getBoundingClientRect()
    const selection = window.getSelection()
    if (selection?.rangeCount && this.editorTarget.contains(selection.anchorNode)) {
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      if (rect.height) anchor = rect
    }
    this.toolbarTarget.dataset.popoverWidth = "560"
    placeEditorPopover(this.toolbarTarget, anchor, { above: true, maxHeight: 180 })
  }

  bindToolbar() {
    if (!this.hasToolbarTarget) return
    this.toolbarTarget.querySelectorAll("[data-command]").forEach((btn) => {
      const command = btn.dataset.command
      const arg = btn.dataset.arg
      btn.addEventListener("mousedown", (e) => e.preventDefault())
      btn.addEventListener("click", (e) => {
        e.preventDefault()
        this.runCommand(command, arg)
        this.refreshToolbar()
      })
    })
  }

  refreshToolbar() {
    if (!this.hasToolbarTarget || !this.editor) return
    this.positionFormatting()
    const stateNames = {
      setParagraph: "paragraph",
      toggleHeading: "heading",
      toggleBold: "bold",
      toggleItalic: "italic",
      toggleUnderline: "underline",
      toggleStrike: "strike",
      toggleCode: "code",
      toggleBulletList: "bulletList",
      toggleOrderedList: "orderedList",
      toggleBlockquote: "blockquote",
      toggleCodeBlock: "codeBlock",
      toggleLink: "link",
    }

    this.toolbarTarget.querySelectorAll("[data-command]").forEach((button) => {
      const stateName = stateNames[button.dataset.command]
      const attributes = button.dataset.arg ? { level: parseInt(button.dataset.arg, 10) } : undefined
      button.classList.toggle("is-active", Boolean(stateName && this.editor.isActive(stateName, attributes)))
      if (stateName) button.setAttribute("aria-pressed", String(this.editor.isActive(stateName, attributes)))
      else button.removeAttribute("aria-pressed")
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
    this.linkUrlTarget.value = this.editor.getAttributes("link").href || ""
    this.linkErrorTarget.textContent = ""
    this.linkDialogTarget.showModal()
    this.linkUrlTarget.focus()
  }

  closeLink() { this.linkDialogTarget.close(); this.editor.commands.focus() }

  linkKeydown(event) {
    if (event.key === "Enter") { event.preventDefault(); this.applyLink() }
  }

  applyLink() {
    const input = this.linkUrlTarget.value.trim()
    if (!input) {
      this.editor.chain().focus().extendMarkRange("link").unsetLink().run()
      this.linkDialogTarget.close()
      return
    }
    const url = /^(https?:|mailto:|tel:|\/|#)/i.test(input) ? input : /^[a-z][a-z0-9+.-]*:/i.test(input) ? null : `https://${input}`
    if (!url) { this.linkErrorTarget.textContent = "Use a web address, email, phone number, or a local path."; return }
    this.linkDialogTarget.close()
    this.editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    this.refreshToolbar()
  }
}
