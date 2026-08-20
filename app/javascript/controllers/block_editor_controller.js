import { Controller } from "@hotwired/stimulus"
import Sortable from "sortablejs"

// Drives the post/page block editor. Each block is a <div data-block-editor-target="block">
// with a data-type attribute and its own inline fields; on any change we serialize the whole
// list into the hidden `content` field as JSON, matching the jsonb shape the server expects:
//   [{ "type": "heading", "data": { "level": 2, "text": "..." } }, ...]
//
// Deliberately NOT a rich-text contenteditable blob (that's how WP's classic editor became an
// HTML-soup liability) — every block is structured fields, so what's stored is always valid,
// renderable data, never partially-typed markup.
export default class extends Controller {
  static targets = ["list", "block", "hiddenField", "blockPicker", "emptyState", "slashMenu", "saveStatus", "undoButton", "redoButton"]
  static values = { types: Array, saveUrl: String, resourceKey: String }

  connect() {
    this.sortable = Sortable.create(this.listTarget, {
      handle: "[data-block-editor-target='dragHandle']",
      animation: 150,
      ghostClass: "opacity-40",
      onEnd: () => this.commit(),
    })
    this.history = []
    this.historyIndex = -1
    this.slashIndex = 0
    this.slashBlock = null
    this.slashField = null
    this.types = this.typesValue.length ? this.typesValue : ["paragraph", "heading", "image", "quote", "list", "code", "separator", "callout", "button"]
    this.saveTimer = null
    this.buildSlashMenu()
    this.pushHistory()
    this.serialize(false)
    this.updateHistoryButtons()
    this.select(null)
    this.bindOutsideClickDeselect()
  }

  disconnect() {
    this.sortable?.destroy()
    this.hideSlashMenu()
    window.removeEventListener("mousedown", this._outsideClickHandler)
    if (this.saveTimer) clearTimeout(this.saveTimer)
  }

  // ---- selection -----------------------------------------------------------

  selectBlock(event) {
    event.stopPropagation()
    this.select(event.target.closest("[data-block-editor-target='block']"))
  }

  select(block) {
    this.blockTargets.forEach((b) => b.classList.remove("block-selected"))
    block?.classList.add("block-selected")
    this.element.classList.toggle("editor-has-selection", !!block)
  }

  // Clicking anywhere outside the editor deselects the active block so its toolbar hides.
  bindOutsideClickDeselect() {
    this._outsideClickHandler = (e) => {
      if (!this.element.contains(e.target)) this.select(null)
    }
    window.addEventListener("mousedown", this._outsideClickHandler)
  }

  // ---- insertion / mutation -------------------------------------------------

  addBlock(event) {
    this.insertBlock(event.params.type, null, true)
  }

  insertAbove(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    this.insertBlock("paragraph", block, false)
  }

  insertBelow(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    this.insertBlock("paragraph", block, true)
  }

  insertBlock(type, after, below = true) {
    const template = document.getElementById(`block-template-${type}`)
    if (!template) return

    const el = template.content.cloneNode(true).firstElementChild
    if (after) {
      below ? after.after(el) : after.before(el)
    } else {
      this.listTarget.appendChild(el)
    }
    this.commit()
    this.toggleEmptyState()
    this.select(el)
    this.focusBlockField(el)
  }

  duplicateBlock(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    const copy = block.cloneNode(true)
    block.after(copy)
    this.commit()
    this.select(copy)
  }

  removeBlock(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    const prev = block.previousElementSibling
    const next = block.nextElementSibling
    block.remove()
    this.commit()
    this.toggleEmptyState()
    const target = prev || next
    if (target) {
      this.select(target)
      this.focusBlockField(target)
    }
  }

  moveUp(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    const prev = block.previousElementSibling
    if (prev) this.listTarget.insertBefore(block, prev)
    this.commit()
  }

  moveDown(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    const next = block.nextElementSibling
    if (next) this.listTarget.insertBefore(next, block)
    this.commit()
  }

  // ---- keyboard ------------------------------------------------------------

  onKeydown(event) {
    const { key, ctrlKey, metaKey, shiftKey } = event

    if ((ctrlKey || metaKey) && key.toLowerCase() === "z") {
      event.preventDefault()
      shiftKey ? this.redo() : this.undo()
      return
    }
    if ((ctrlKey || metaKey) && key.toLowerCase() === "y") {
      event.preventDefault()
      this.redo()
      return
    }

    const field = event.target
    const block = field.closest("[data-block-editor-target='block']")
    if (!block) return

    // Slash menu navigation
    if (this.slashMenuOpen() && (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === "Escape" || key === "Tab")) {
      if (key === "ArrowDown") { event.preventDefault(); this.slashIndex = (this.slashIndex + 1) % this.slashCount(); this.highlightSlash(); return }
      if (key === "ArrowUp") { event.preventDefault(); this.slashIndex = (this.slashIndex - 1 + this.slashCount()) % this.slashCount(); this.highlightSlash(); return }
      if (key === "Escape") { event.preventDefault(); this.removeSlashSlash(field); this.hideSlashMenu(); return }
      event.preventDefault()
      this.slashInsert()
      return
    }

    // Enter in a text block → new paragraph below
    if (key === "Enter" && !event.shiftKey && (field.tagName === "TEXTAREA" || field.tagName === "INPUT")) {
      if (block.dataset.type === "paragraph" || block.dataset.type === "heading") {
        event.preventDefault()
        this.insertBlock("paragraph", block, true)
      }
      return
    }

    // Backspace on an empty text block → remove it, focus the previous
    if (key === "Backspace" && (field.tagName === "TEXTAREA" || field.tagName === "INPUT")) {
      if (field.value === "" && ["paragraph", "heading", "quote", "list", "callout"].includes(block.dataset.type)) {
        event.preventDefault()
        this.removeBlock({ target: block })
      }
    }
  }

  // ---- slash command ---------------------------------------------------------

  onInput(event) {
    const field = event.target
    const value = field.value

    if (field.dataset.field === "text" && value.endsWith("/") && !this.slashMenuOpen()) {
      this.openSlashMenu(field.closest("[data-block-editor-target='block']"), field)
    } else if (!value.endsWith("/")) {
      this.hideSlashMenu()
    }
    this.serialize()
  }

  buildSlashMenu() {
    this.slashMenuTarget.innerHTML = ""
    this.types.forEach((type, i) => {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.textContent = type.charAt(0).toUpperCase() + type.slice(1)
      btn.dataset.index = i
      btn.dataset.action = "block-editor#slashInsert"
      btn.className = "w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-gray-50"
      this.slashMenuTarget.appendChild(btn)
    })
  }

  openSlashMenu(block, field) {
    this.slashBlock = block
    this.slashField = field
    this.slashIndex = 0
    this.slashMenuTarget.classList.remove("hidden")
    this.slashMenuTarget.style.top = `${block.offsetTop + block.offsetHeight + 4}px`
    this.highlightSlash()
  }

  hideSlashMenu() {
    this.slashMenuTarget.classList.add("hidden")
    this.slashBlock = null
    this.slashField = null
  }

  slashMenuOpen() {
    return !this.slashMenuTarget.classList.contains("hidden")
  }

  slashCount() {
    return this.types.length
  }

  highlightSlash() {
    this.slashMenuTarget.querySelectorAll("button").forEach((b, i) => {
      b.classList.toggle("bg-gray-100", i === this.slashIndex)
    })
  }

  slashInsert() {
    const type = this.types[this.slashIndex]
    if (!type || !this.slashBlock) return

    const field = this.slashField
    if (field) field.value = field.value.slice(0, -1)
    const block = this.slashBlock
    this.hideSlashMenu()
    this.insertBlock(type, block, true)
  }

  removeSlashSlash(field) {
    if (field) field.value = field.value.slice(0, -1)
  }

  // ---- serialization + history ------------------------------------------------

  serialize(push = true) {
    this.hiddenFieldTarget.value = this.serializeValue()
    if (push) this.commit()
    this.toggleEmptyState()
  }

  serializeValue() {
    return JSON.stringify(this.blockTargets.map((el) => {
      const data = {}
      el.querySelectorAll("[data-field]").forEach((field) => {
        data[field.dataset.field] = field.type === "checkbox" ? field.checked : field.value
      })
      return { type: el.dataset.type, data }
    }))
  }

  commit() {
    const current = this.hiddenFieldTarget.value
    if (this.historyIndex >= 0 && this.history[this.historyIndex] === current) return
    if (this.historyIndex < this.history.length - 1) this.history = this.history.slice(0, this.historyIndex + 1)
    this.history.push(current)
    if (this.history.length > 50) this.history.shift()
    this.historyIndex = this.history.length - 1
    this.updateHistoryButtons()
    this.scheduleAutosave()
  }

  pushHistory() {
    this.history = [this.serializeValue()]
    this.historyIndex = 0
  }

  updateHistoryButtons() {
    if (this.hasUndoButtonTarget) this.undoButtonTarget.disabled = this.historyIndex <= 0
    if (this.hasRedoButtonTarget) this.redoButtonTarget.disabled = this.historyIndex >= this.history.length - 1
  }

  undo() {
    if (this.historyIndex <= 0) return
    this.historyIndex -= 1
    this.renderBlocks(this.history[this.historyIndex])
    this.updateHistoryButtons()
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return
    this.historyIndex += 1
    this.renderBlocks(this.history[this.historyIndex])
    this.updateHistoryButtons()
  }

  renderBlocks(json) {
    const blocks = JSON.parse(json || "[]")
    this.listTarget.innerHTML = ""
    blocks.forEach((block) => {
      const template = document.getElementById(`block-template-${block.type}`)
      if (!template) return
      const el = template.content.cloneNode(true).firstElementChild
      el.setAttribute("data-type", block.type)
      el.querySelectorAll("[data-field]").forEach((field) => {
        const key = field.dataset.field
        if (field.type === "checkbox") field.checked = !!block.data[key]
        else field.value = block.data[key] ?? ""
      })
      this.listTarget.appendChild(el)
    })
    this.hiddenFieldTarget.value = json
    this.toggleEmptyState()
    this.select(null)
  }

  // ---- autosave ------------------------------------------------------------

  scheduleAutosave() {
    if (!this.saveUrlValue) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.setSaveStatus("Unsaved changes")
    this.saveTimer = setTimeout(() => this.autosave(), 1200)
  }

  autosave() {
    this.saveTimer = null
    this.setSaveStatus("Saving…")
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content

    fetch(this.saveUrlValue, {
      method: "PATCH",
      headers: {
        "X-CSRF-Token": csrf,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        [this.resourceKeyValue || "post"]: { draft_content: this.hiddenFieldTarget.value }
      })
    })
      .then((r) => {
        if (!r.ok) throw new Error(`save failed: ${r.status}`)
        this.setSaveStatus("Saved")
      })
      .catch(() => this.setSaveStatus("Save failed — check connection"))
  }

  setSaveStatus(text) {
    if (!this.hasSaveStatusTarget) return
    this.saveStatusTarget.textContent = text
    this.saveStatusTarget.classList.toggle("text-red-500", text.startsWith("Save failed"))
  }

  // ---- helpers -------------------------------------------------------------

  focusBlockField(block) {
    const field = block.querySelector("textarea, input:not([type='hidden']), select")
    if (!field) return
    field.focus()
    if (field.tagName === "INPUT") field.select()
  }

  toggleEmptyState() {
    if (!this.hasEmptyStateTarget) return
    this.emptyStateTarget.classList.toggle("hidden", this.blockTargets.length > 0)
  }
}
