import { placeEditorPopover } from "editor_popover"
import { Controller } from "@hotwired/stimulus"
import Sortable from "sortablejs"

// ---- Markdown → block parsing -------------------------------------------------
// The editor stores structured blocks (jsonb), not markdown. Pasting markdown is converted
// here into the editor's own blocks: headings/lists/quotes/code/separators become their
// structured blocks; text with inline formatting (bold/italic/code/links) becomes a
// rich_text block holding the equivalent TipTap JSON, which the server renders safely.

const INLINE_RE = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|~~([^~\n]+)~~|`([^`\n]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g
const HEADING_RE = /^(#{1,4})\s+(.*)$/
const QUOTE_RE = /^\s*>\s?(.*)$/
const BULLET_RE = /^\s*[-*+]\s+(.*)$/
const ORDERED_RE = /^\s*\d+[.)]\s+(.*)$/
const SEPARATOR_RE = /^\s*(?:---|\*\*\*)\s*$/
const FENCE_RE = /^```\s*/

function stripInline(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
}

function hasInline(text) {
  INLINE_RE.lastIndex = 0
  return INLINE_RE.test(text)
}

// Convert a line with inline formatting into a rich_text block's TipTap JSON document.
function inlineToJson(text) {
  const nodes = []
  let last = 0
  let m
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) nodes.push({ type: "text", text: text.slice(last, m.index) })
    if (m[1] !== undefined) nodes.push({ type: "text", text: m[1], marks: [{ type: "bold" }] })
    else if (m[2] !== undefined) nodes.push({ type: "text", text: m[2], marks: [{ type: "italic" }] })
    else if (m[3] !== undefined) nodes.push({ type: "text", text: m[3], marks: [{ type: "strike" }] })
    else if (m[4] !== undefined) nodes.push({ type: "text", text: m[4], marks: [{ type: "code" }] })
    else if (m[5] !== undefined) nodes.push({ type: "text", text: m[5], marks: [{ type: "link", attrs: { href: m[6] } }] })
    last = INLINE_RE.lastIndex
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) })
  return JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: nodes }] })
}

function textBlock(line) {
  return hasInline(line)
    ? { type: "rich_text", data: { json: inlineToJson(line) } }
    : { type: "paragraph", data: { text: line } }
}

// Parse a pasted markdown string into the editor's block array. Returns [] if there's
// nothing structural (a single bare line → let the browser paste it normally).
export function parseMarkdown(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === "") { i += 1; continue }

    // Fenced code block
    if (FENCE_RE.test(line)) {
      const code = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { code.push(lines[i]); i += 1 }
      i += 1 // closing fence
      blocks.push({ type: "code", data: { language: "plaintext", code: code.join("\n") } })
      continue
    }

    // Heading
    const h = line.match(HEADING_RE)
    if (h) {
      blocks.push({ type: "heading", data: { level: h[1].length, text: stripInline(h[2]) } })
      i += 1
      continue
    }

    // Separator
    if (SEPARATOR_RE.test(line)) {
      blocks.push({ type: "separator", data: {} })
      i += 1
      continue
    }

    // Blockquote: consecutive "> " lines
    if (QUOTE_RE.test(line)) {
      const quote = []
      while (i < lines.length && QUOTE_RE.test(lines[i])) { quote.push(lines[i].match(QUOTE_RE)[1]); i += 1 }
      blocks.push({ type: "quote", data: { text: stripInline(quote.join("\n")), attribution: "" } })
      continue
    }

    // Bullet list: consecutive "- / * / +" lines
    if (BULLET_RE.test(line)) {
      const items = []
      while (i < lines.length && BULLET_RE.test(lines[i])) { items.push(lines[i].match(BULLET_RE)[1]); i += 1 }
      blocks.push({ type: "list", data: { ordered: false, items: items.map(stripInline).join("\n") } })
      continue
    }

    // Ordered list: consecutive "1. " lines
    if (ORDERED_RE.test(line)) {
      const items = []
      while (i < lines.length && ORDERED_RE.test(lines[i])) { items.push(lines[i].match(ORDERED_RE)[1]); i += 1 }
      blocks.push({ type: "list", data: { ordered: true, items: items.map(stripInline).join("\n") } })
      continue
    }

    // Paragraph: consecutive non-marker lines, one block per line (matches the editor's
    // one-paragraph-per-block model; Enter already splits this way).
    const para = []
    while (i < lines.length && lines[i].trim() !== "" && !HEADING_RE.test(lines[i]) &&
           !QUOTE_RE.test(lines[i]) && !BULLET_RE.test(lines[i]) && !ORDERED_RE.test(lines[i]) &&
           !SEPARATOR_RE.test(lines[i]) && !FENCE_RE.test(lines[i])) {
      para.push(lines[i])
      i += 1
    }
    para.forEach((l) => blocks.push(textBlock(l)))
  }

  return blocks
}

// Drives the post/page block editor. Each block is a <div data-block-editor-target="block">
// with a data-type attribute and its own inline fields; on any change we serialize the whole
// list into the hidden `content` field as JSON, matching the jsonb shape the server expects:
//   [{ "type": "heading", "data": { "level": 2, "text": "..." } }, ...]
//
// Deliberately NOT a rich-text contenteditable blob (that's how WP's classic editor became an
// HTML-soup liability) — every block is structured fields, so what's stored is always valid,
// renderable data, never partially-typed markup.
export default class extends Controller {
  static targets = ["list", "block", "hiddenField", "blockPicker", "emptyState", "slashMenu", "saveStatus", "undoButton", "redoButton", "wordCount", "inspector", "settingsToggle"]
  static values = { types: Array, saveUrl: String, resourceKey: String, autosaveMetadata: Boolean }

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
    requestAnimationFrame(() => this.updateWordCount())
    this.bindPickerOutsideClose()
    if (this.hasInspectorTarget) {
      let closed = window.innerWidth < 1000
      try { const preference = localStorage.getItem("ink-post-settings"); if (preference !== null) closed = preference === "closed" } catch {}
      this.setInspector(!closed)
    }
    this._reposition = () => {
      if (this.slashMenuOpen()) this.positionSlashMenu()
      if (this.hasBlockPickerTarget && this.blockPickerTarget.open) this.positionPicker()
      this.listTarget.querySelectorAll(".composer-block-menu[open]").forEach(menu => this.positionBlockMenu(menu))
    }
    window.addEventListener("resize", this._reposition)
    window.addEventListener("scroll", this._reposition, true)
    window.visualViewport?.addEventListener("resize", this._reposition)
    this.bindMarkdownPaste()
    this.resizeObserver = new ResizeObserver(() => this.resizeTextFields())
    this.resizeObserver.observe(this.listTarget)
    this.resizeTextFields()
    this._editorKeydown = event => {
      if (event.defaultPrevented) return
      const popover = event.target.closest(".composer-block-popover, .composer-inserter")
      if (popover && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && (!event.target.matches("input, textarea") || event.key === "ArrowDown")) {
        const buttons = [...popover.querySelectorAll("button")].filter(button => button.getClientRects().length && !button.disabled)
        if (buttons.length) {
          event.preventDefault()
          const current = buttons.indexOf(document.activeElement)
          const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length
          buttons[next].focus({ preventScroll: true })
          const item = buttons[next]
          if (item.offsetTop < popover.scrollTop) popover.scrollTop = item.offsetTop
          else if (item.offsetTop + item.offsetHeight > popover.scrollTop + popover.clientHeight) popover.scrollTop = item.offsetTop + item.offsetHeight - popover.clientHeight
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        const form = this.element.closest("form")
        const button = this.element.querySelector('.composer-save[type="submit"]')
        if (button) form?.requestSubmit(button)
        else form?.requestSubmit()
      }
      if (event.key === "Escape") {
        const menu = event.target.closest(".composer-block-menu[open]")
        if (menu) { menu.open = false; menu.querySelector("summary").focus() }
        if (this.blockPickerTarget.open) { this.closePicker(); this.blockPickerTarget.querySelector("summary").focus() }
      }
    }
    this.element.addEventListener("keydown", this._editorKeydown)
    this._richSlash = event => {
      const block = event.target.closest('[data-block-editor-target="block"]')
      if (event.detail.query === null) {
        if (this.slashBlock === block) this.hideSlashMenu()
        return
      }
      this.openSlashMenu(block, block.querySelector("[contenteditable=true]"))
      this.slashRichIndex = event.detail.index
      this.buildSlashMenu(event.detail.query)
    }
    this._richMenuKeydown = event => {
      if (event.target.isContentEditable && this.slashMenuOpen() && ["ArrowUp", "ArrowDown", "Enter", "Escape", "Tab"].includes(event.key)) {
        this.onKeydown(event)
        event.stopPropagation()
      }
    }
    this.listTarget.addEventListener("composer:slash", this._richSlash)
    this.listTarget.addEventListener("keydown", this._richMenuKeydown, true)
    this._formInput = (event) => {
      if (!this.listTarget.contains(event.target) && event.target.matches("input, textarea, select")) {
        if (this.autosaveMetadataValue) this.scheduleAutosave()
        else { this.metadataDirty = true; this.setSaveStatus("Unsaved settings") }
      }
    }
    this.element.closest("form")?.addEventListener("input", this._formInput)
  }

  disconnect() {
    document.body.classList.remove("ink-writing-focus")
    this.sortable?.destroy()
    this.resizeObserver?.disconnect()
    window.removeEventListener("resize", this._reposition)
    window.removeEventListener("scroll", this._reposition, true)
    window.visualViewport?.removeEventListener("resize", this._reposition)
    this.element.removeEventListener("keydown", this._editorKeydown)
    this.listTarget.removeEventListener("composer:slash", this._richSlash)
    this.listTarget.removeEventListener("keydown", this._richMenuKeydown, true)
    this.element.closest("form")?.removeEventListener("input", this._formInput)
    this.hideSlashMenu()
    window.removeEventListener("mousedown", this._outsideClickHandler)
    this.listTarget.removeEventListener("paste", this._pasteHandler)
    if (this.saveTimer) clearTimeout(this.saveTimer)
  }

  // Sidebar links can point into progressively disclosed plugin settings.
  revealPanel(event) {
    const link = event.target.closest("a[href]")
    if (!link) return
    const url = new URL(link.href, window.location.href)
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)))
    if (!target || !this.element.closest("form")?.contains(target)) return
    event.preventDefault()
    let parent = target.parentElement
    while (parent) {
      if (parent.tagName === "DETAILS") parent.open = true
      parent = parent.parentElement
    }
    target.scrollIntoView({ block: "start" })
  }

  toggleFocus(event) {
    const focused = document.body.classList.toggle("ink-writing-focus")
    event.currentTarget.setAttribute("aria-pressed", String(focused))
    event.currentTarget.textContent = focused ? "Exit focus" : "Focus"
  }

  // Paste markdown into a block field → convert it to the editor's own blocks. Delegated on
  // the list so every text field is covered. Only takes over when the field is empty (a
  // fresh block) so we never clobber existing text; rich_text blocks are skipped because
  // TipTap handles its own paste.
  bindMarkdownPaste() {
    this._pasteHandler = (event) => {
      const field = event.target
      const block = field.closest("[data-block-editor-target='block']")
      if (!block || block.dataset.type === "rich_text") return
      if (field.value?.length) return

      const text = event.clipboardData?.getData("text/plain") || ""
      if (!text.trim()) return
      const blocks = parseMarkdown(text)
      const structural = blocks.length > 1 || blocks.some((b) => b.type !== "paragraph")
      if (!structural) return

      event.preventDefault()
      this.replaceBlockWithBlocks(block, blocks)
    }
    this.listTarget.addEventListener("paste", this._pasteHandler)
  }

  // ---- picker ---------------------------------------------------------------

  // Close the "+ Add block" <details> when clicking anywhere outside it, so it never lingers
  // open after focus moves away. The summary toggle still works natively.
  bindPickerOutsideClose() {
    this._outsideClickHandler = (e) => {
      const picker = this.blockPickerTarget
      if (picker.open && !picker.contains(e.target)) picker.removeAttribute("open")
      this.listTarget.querySelectorAll(".composer-block-menu[open]").forEach(menu => {
        if (!menu.contains(e.target)) menu.open = false
      })
      if (this.slashMenuOpen() && !this.slashMenuTarget.contains(e.target) && e.target !== this.slashField) this.hideSlashMenu()
    }
    window.addEventListener("mousedown", this._outsideClickHandler)
  }

  closePicker() {
    this.blockPickerTarget.removeAttribute("open")
  }

  // Live filter for the picker's search box: hides block/pattern buttons that don't match.
  filterPicker(event) {
    const q = event.target.value.trim().toLowerCase()
    this.blockPickerTarget.querySelectorAll("[data-search-item]").forEach((btn) => {
      const haystack = `${btn.dataset.searchItem} ${btn.dataset.searchGroup}`.toLowerCase()
      btn.classList.toggle("hidden", q && !haystack.includes(q))
    })
  }

  // ---- insertion / mutation -------------------------------------------------

  addBlock(event) {
    this.insertBlock(event.params.type, null, true)
    this.closePicker()
  }

  addPattern(event) {
    this.insertPattern(event.params.pattern, null, true)
    this.closePicker()
  }

  insertAbove(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    block.querySelector(".composer-block-menu")?.removeAttribute("open")
    this.insertBlock("paragraph", block, false)
  }

  insertBelow(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    block.querySelector(".composer-block-menu")?.removeAttribute("open")
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
    this.focusBlockField(el)
  }

  // Insert a whole pattern (a <template> holding several pre-filled blocks) after `after`.
  insertPattern(name, after, below = true) {
    const template = document.getElementById(`pattern-template-${name}`)
    if (!template) return

    const fragment = template.content.cloneNode(true)
    const first = fragment.firstElementChild
    const blocks = Array.from(fragment.children)
    if (!first) return

    if (after) {
      if (below) after.after(...blocks)
      else after.before(...blocks)
    } else {
      this.listTarget.append(...blocks)
    }
    this.commit()
    this.toggleEmptyState()
    this.focusBlockField(first)
  }

  duplicateBlock(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    const data = {}
    block.querySelectorAll("[data-field]").forEach(field => { data[field.dataset.field] = field.type === "checkbox" ? field.checked : field.value })
    const copy = this.buildBlockEl({ type: block.dataset.type, data })
    block.after(copy)
    this.commit()
    block.querySelector(".composer-block-menu")?.removeAttribute("open")
    copy.querySelector(".composer-block-menu")?.removeAttribute("open")
    this.focusBlockField(copy)
  }

  removeBlock(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    const prev = block.previousElementSibling
    const next = block.nextElementSibling
    block.remove()
    this.commit()
    this.toggleEmptyState()
    if (prev || next) this.focusBlockField(prev || next)
  }

  moveUp(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    const prev = block.previousElementSibling
    if (prev) this.listTarget.insertBefore(block, prev)
    block.querySelector(".composer-block-menu")?.removeAttribute("open")
    this.commit()
    this.focusBlockField(block)
  }

  moveDown(event) {
    const block = event.target.closest("[data-block-editor-target='block']")
    const next = block.nextElementSibling
    if (next) this.listTarget.insertBefore(next, block)
    block.querySelector(".composer-block-menu")?.removeAttribute("open")
    this.commit()
    this.focusBlockField(block)
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
      if (!this.slashCount() && key !== "Escape") { event.preventDefault(); return }
      if (key === "ArrowDown") { event.preventDefault(); this.slashIndex = (this.slashIndex + 1) % this.slashCount(); this.highlightSlash(); return }
      if (key === "ArrowUp") { event.preventDefault(); this.slashIndex = (this.slashIndex - 1 + this.slashCount()) % this.slashCount(); this.highlightSlash(); return }
      if (key === "Escape") { event.preventDefault(); this.removeSlashSlash(field); this.hideSlashMenu(); return }
      event.preventDefault()
      this.slashInsert()
      return
    }

    if (event.isComposing) return
    if ((ctrlKey || metaKey) && shiftKey && key === "ArrowUp") {
      event.preventDefault(); this.moveUp({ target: block }); return
    }
    if ((ctrlKey || metaKey) && shiftKey && key === "ArrowDown") {
      event.preventDefault(); this.moveDown({ target: block }); return
    }
    const textBlock = ["paragraph", "heading"].includes(block.dataset.type) && field.tagName === "TEXTAREA"
    if (!textBlock) return
    // Split at the selection, keeping the text on either side of the caret.
    if (key === "Enter" && !shiftKey) {
      event.preventDefault()
      const suffix = field.value.slice(field.selectionEnd)
      field.value = field.value.slice(0, field.selectionStart)
      const next = this.buildBlockEl({ type: "paragraph", data: { text: suffix } })
      block.after(next)
      this.commit(); this.focusBlockField(next); this.resizeTextFields()
      return
    }
    if (key === "Backspace" && field.selectionStart === 0 && field.selectionEnd === 0) {
      const previous = block.previousElementSibling
      const previousField = previous?.matches('[data-type="paragraph"], [data-type="heading"]') && previous.querySelector('textarea[data-field="text"]')
      if (previousField) {
        event.preventDefault()
        const caret = previousField.value.length
        previousField.value += field.value
        block.remove(); this.commit(); previousField.focus()
        previousField.setSelectionRange(caret, caret); this.resizeTextFields()
      } else if (!field.value) {
        event.preventDefault(); this.removeBlock({ target: block })
      }
    }
  }

  // ---- slash command ---------------------------------------------------------

  onInput(event) {
    const field = event.target
    const value = field.value || ""
    this.resizeTextFields()

    if (field.dataset.field === "text" && /^\/[a-z _-]*$/i.test(value) && field.selectionStart === value.length) {
      this.openSlashMenu(field.closest('[data-block-editor-target="block"]'), field)
      this.buildSlashMenu(value.slice(1))
    } else {
      this.hideSlashMenu()
    }
    this.serialize()
  }

  buildSlashMenu(query = "") {
    const labels = { paragraph: "Text", heading: "Heading", rich_text: "Formatted text", image: "Image", quote: "Quote", list: "List", code: "Code", separator: "Divider", callout: "Callout", button: "Button" }
    this.slashTypes = this.types.filter(type => `${labels[type] || type} ${type}`.toLowerCase().includes(query.toLowerCase().replaceAll("_", " ")))
    this.slashIndex = 0
    this.slashMenuTarget.replaceChildren()
    const heading = document.createElement("div")
    heading.className = "composer-slash-heading"
    heading.textContent = this.slashTypes.length ? "INSERT BLOCK · ↑ ↓ TO NAVIGATE" : "No matching blocks"
    this.slashMenuTarget.append(heading)
    this.slashTypes.forEach((type, index) => {
      const button = document.createElement("button")
      button.type = "button"
      const icon = this.element.querySelector(`template[data-composer-icon="${type}"]`)
      if (icon) button.append(icon.content.cloneNode(true))
      const label = document.createElement("span")
      label.textContent = labels[type] || type.replaceAll("_", " ")
      button.append(label)
      button.dataset.index = index
      button.dataset.action = "mousedown->block-editor#keepSelection click->block-editor#slashInsert"
      button.setAttribute("role", "option")
      this.slashMenuTarget.append(button)
    })
    this.highlightSlash()
    if (this.slashBlock) this.positionSlashMenu()
  }

  keepSelection(event) { event.preventDefault() }

  openSlashMenu(block, field) {
    this.slashBlock = block
    this.slashField = field
    this.slashMenuTarget.classList.remove("hidden")
    this.element.classList.add("has-slash-menu")
    this.positionSlashMenu()
  }

  positionSlashMenu() {
    if (!this.slashField?.isConnected) { this.hideSlashMenu(); return }
    let anchor = this.slashField.getBoundingClientRect()
    if (this.slashField.isContentEditable) {
      const selection = window.getSelection()
      if (selection?.rangeCount && this.slashField.contains(selection.anchorNode)) {
        const rect = selection.getRangeAt(0).getBoundingClientRect()
        if (rect.height) anchor = rect
      }
    }
    placeEditorPopover(this.slashMenuTarget, anchor, { maxHeight: 300 })
  }

  pickerToggled() {
    if (!this.blockPickerTarget.open) return
    this.positionPicker()
    this.blockPickerTarget.querySelector('input[type="search"]')?.focus({ preventScroll: true })
  }

  positionPicker() {
    const panel = this.blockPickerTarget.querySelector(".composer-inserter")
    if (!panel) return
    panel.dataset.popoverWidth = "340"
    placeEditorPopover(panel, this.blockPickerTarget.querySelector("summary").getBoundingClientRect(), { maxHeight: 450 })
  }

  blockMenuToggled(event) {
    const menu = event.target
    if (menu.open) this.positionBlockMenu(menu)
  }

  positionBlockMenu(menu) {
    const panel = menu.querySelector(".composer-block-popover")
    panel.dataset.popoverWidth = "230"
    placeEditorPopover(panel, menu.querySelector("summary").getBoundingClientRect(), { maxHeight: 400 })
  }

  toggleInspector() {
    if (document.body.classList.contains("ink-writing-focus")) {
      document.body.classList.remove("ink-writing-focus")
      const focus = this.element.querySelector('[data-action="block-editor#toggleFocus"]')
      focus?.setAttribute("aria-pressed", "false")
      if (focus) focus.textContent = "Focus"
      this.setInspector(true)
    } else this.setInspector(this.inspectorTarget.hidden)
  }

  setInspector(open) {
    this.inspectorTarget.hidden = !open
    this.element.classList.toggle("settings-hidden", !open)
    this.settingsToggleTarget.setAttribute("aria-expanded", String(open))
    try { localStorage.setItem("ink-post-settings", open ? "open" : "closed") } catch {}
    requestAnimationFrame(() => this.resizeTextFields())
  }

  hideSlashMenu() {
    this.slashMenuTarget.classList.add("hidden")
    this.element.classList.remove("has-slash-menu")
    this.slashBlock = null
    this.slashField = null
    this.slashRichIndex = null
  }

  slashMenuOpen() { return !this.slashMenuTarget.classList.contains("hidden") }
  slashCount() { return this.slashTypes?.length || 0 }

  highlightSlash() {
    this.slashMenuTarget.querySelectorAll("button").forEach((button, index) => {
      button.classList.toggle("is-selected", index === this.slashIndex)
      button.setAttribute("aria-selected", String(index === this.slashIndex))
    })
    const selected = this.slashMenuTarget.querySelector(".is-selected")
    if (selected) {
      const menu = this.slashMenuTarget
      if (selected.offsetTop < menu.scrollTop) menu.scrollTop = selected.offsetTop
      else if (selected.offsetTop + selected.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = selected.offsetTop + selected.offsetHeight - menu.clientHeight
    }
  }

  slashInsert(event) {
    const index = event?.currentTarget?.dataset.index
    const type = this.slashTypes[index === undefined ? this.slashIndex : Number(index)]
    if (!type || !this.slashBlock) return
    const block = this.slashBlock
    const richIndex = this.slashRichIndex
    this.hideSlashMenu()
    const inserted = { type, data: type === "heading" ? { level: 2 } : {} }
    if (block.dataset.type === "rich_text" && Number.isInteger(richIndex)) {
      const doc = JSON.parse(block.querySelector('[data-field="json"]').value)
      const before = doc.content.slice(0, richIndex)
      const after = doc.content.slice(richIndex + 1)
      const wrap = content => ({ type: "rich_text", data: { json: JSON.stringify({ type: "doc", content }) } })
      this.replaceBlockWithBlocks(block, [...(before.length ? [wrap(before)] : []), inserted, ...(after.length ? [wrap(after)] : [])], before.length ? 1 : 0)
    } else this.replaceBlockWithBlocks(block, [inserted])
  }

  removeSlashSlash() { /* Escape leaves the author's text intact. */ }

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

  // Refresh the hidden field from the DOM, then record history. Every mutation must flow
  // through here so the form's hidden input always reflects the current block list —
  // otherwise deleting a block would leave the stale serialized value behind.
  commit() {
    this.hiddenFieldTarget.value = this.serializeValue()
    this.updateWordCount()
    this.resizeTextFields()
    this.element.dispatchEvent(new CustomEvent("composer:change", { bubbles: true }))
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
      const el = this.buildBlockEl(block)
      if (el) this.listTarget.appendChild(el)
    })
    this.hiddenFieldTarget.value = json
    this.element.dispatchEvent(new CustomEvent("composer:change", { bubbles: true }))
    this.updateWordCount()
    this.resizeTextFields()
    this.scheduleAutosave()
    this.toggleEmptyState()
  }

  // Materialize a single block element from { type, data } by cloning its template and
  // filling the data-field inputs. Shared by undo/redo and markdown-paste insertion.
  buildBlockEl(block) {
    const template = document.getElementById(`block-template-${block.type}`)
    if (!template) return null
    const el = template.content.cloneNode(true).firstElementChild
    el.setAttribute("data-type", block.type)
    el.querySelectorAll("[data-field]").forEach((field) => {
      const key = field.dataset.field
      if (field.type === "checkbox") field.checked = !!block.data[key]
      else field.value = block.data[key] ?? ""
    })
    return el
  }

  // Replace one block with a sequence of parsed markdown blocks (in its place), then commit.
  replaceBlockWithBlocks(block, blocks, focusIndex = 0) {
    const els = blocks.map((b) => this.buildBlockEl(b)).filter(Boolean)
    if (!els.length) return
    els.forEach((el) => block.before(el))
    block.remove()
    this.commit()
    this.toggleEmptyState()
    this.focusBlockField(els[focusIndex])
  }

  // ---- programmatic mutation API --------------------------------------------
  // Used by tools like the AI Copilot to read and restructure the document.

  // Current blocks as a {type, data} array (mirrors what the hidden field stores).
  getBlocks() {
    return JSON.parse(this.serializeValue() || "[]")
  }

  // Append blocks (in order) to the end of the document.
  appendBlocks(blocks) {
    const els = blocks.map((b) => this.buildBlockEl(b)).filter(Boolean)
    if (!els.length) return
    this.listTarget.append(...els)
    this.commit()
    this.toggleEmptyState()
    const last = this.listTarget.lastElementChild
    if (last) this.focusBlockField(last)
  }

  // Replace every block with a new set (used for "rewrite the whole page").
  replaceAllBlocks(blocks) {
    const els = blocks.map((b) => this.buildBlockEl(b)).filter(Boolean)
    this.listTarget.innerHTML = ""
    if (els.length) this.listTarget.append(...els)
    this.commit()
    this.toggleEmptyState()
    if (els[0]) this.focusBlockField(els[0])
  }

  // Replace blocks in the inclusive-ish range [start, start + count) with new blocks.
  replaceRange(start, count, blocks) {
    const nodes = Array.from(this.listTarget.children).filter((el) => el.hasAttribute("data-block-editor-target"))
    const targets = nodes.slice(start, start + count)
    const els = blocks.map((b) => this.buildBlockEl(b)).filter(Boolean)
    targets.forEach((n) => n.remove())
    const anchor = nodes[start + count] || null
    if (anchor) anchor.before(...els)
    else this.listTarget.append(...els)
    this.commit()
    this.toggleEmptyState()
    if (els[0]) this.focusBlockField(els[0])
  }

  // Remove count blocks starting at start.
  removeBlocks(start, count) {
    const nodes = Array.from(this.listTarget.children).filter((el) => el.hasAttribute("data-block-editor-target"))
    nodes.slice(start, start + count).forEach((n) => n.remove())
    this.commit()
    this.toggleEmptyState()
  }

  // Overwrite a block's data-field values at the given index.
  updateBlock(index, data) {
    const nodes = Array.from(this.listTarget.children).filter((el) => el.hasAttribute("data-block-editor-target"))
    const el = nodes[index]
    if (!el) return false
    Object.entries(data || {}).forEach(([key, value]) => {
      const field = el.querySelector(`[data-field="${key}"]`)
      if (!field) return
      if (field.type === "checkbox") field.checked = !!value
      else field.value = value ?? ""
      field.dispatchEvent(new Event(field.type === "checkbox" ? "change" : "input", { bubbles: true }))
    })
    this.commit()
    return true
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
    if (this.autosaveInFlight) { this.scheduleAutosave(); return }
    this.autosaveInFlight = true
    this.setSaveStatus("Saving…")
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content
    const form = this.element.closest("form")
    const payload = this.autosaveMetadataValue ? new FormData(form) : new FormData()
    if (!this.autosaveMetadataValue) payload.set(`${this.resourceKeyValue || "post"}[draft_content]`, this.hiddenFieldTarget.value)
    const snapshot = JSON.stringify([...payload.entries()].filter(([key]) => key !== "authenticity_token"))

    fetch(this.saveUrlValue, {
      method: "PATCH",
      headers: {
        "X-CSRF-Token": csrf,
        "Accept": "application/json"
      },
      body: payload
    })
      .then((r) => {
        if (!r.ok) throw new Error(`save failed: ${r.status}`)
        if (!this.element.isConnected) return
        const currentPayload = this.autosaveMetadataValue ? new FormData(form) : new FormData()
        if (!this.autosaveMetadataValue) currentPayload.set(`${this.resourceKeyValue || "post"}[draft_content]`, this.hiddenFieldTarget.value)
        const current = JSON.stringify([...currentPayload.entries()].filter(([key]) => key !== "authenticity_token"))
        if (current === snapshot) this.setSaveStatus(this.metadataDirty ? "Text saved · unsaved settings" : "Saved")
        else if (!this.saveTimer) this.scheduleAutosave()
      })
      .catch(() => this.setSaveStatus("Save failed — check connection"))
      .finally(() => { this.autosaveInFlight = false })
  }

  setSaveStatus(text) {
    if (!this.hasSaveStatusTarget) return
    this.saveStatusTarget.textContent = text
    this.saveStatusTarget.classList.toggle("text-red-500", text.startsWith("Save failed"))
  }

  // Live word count + reading time (~200 wpm), shown in the editor toolbar.
  updateWordCount() {
    if (!this.hasWordCountTarget) return
    const words = this.blockTargets.reduce((sum, el) => {
      if (el.dataset.type === "rich_text") {
        try {
          const doc = JSON.parse(el.querySelector('[data-field="json"]')?.value || "{}")
          const text = node => node.text || (node.content || []).map(text).join(" ")
          return sum + (text(doc).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length || 0)
        } catch { return sum }
      }
      el.querySelectorAll("[data-field]").forEach((f) => {
        // Skip hidden serialized fields (e.g. page_builder ERB) — count real text only.
        if (f.type === "textarea" || f.type === "text") {
          sum += ((f.value || "").match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length || 0)
        }
      })
      return sum
    }, 0)
    const minutes = Math.max(1, Math.ceil(words / 200))
    this.wordCountTarget.textContent = `${words.toLocaleString()} words · ${minutes} min read`
  }

  // ---- helpers -------------------------------------------------------------

  focusBlockField(block) {
    const field = [...block.querySelectorAll("[contenteditable=true], textarea, input:not([type='hidden']), select")].find(candidate => !candidate.closest("dialog"))
    this.resizeTextFields()
    if (!field && block.dataset.type === "rich_text") {
      block.dataset.editorAutofocus = "true"
      requestAnimationFrame(() => block.querySelector("[contenteditable=true]")?.focus())
    }
    if (!field) return
    field.focus()
    if (field.tagName === "INPUT") field.select()
    if (field.tagName === "TEXTAREA") field.setSelectionRange(0, 0)
  }

  resizeTextFields() {
    this.element.querySelectorAll('.composer-title, [data-block-editor-target="list"] textarea').forEach(field => {
      if (field.classList.contains("code-editor")) return
      const before = field.style.height
      field.style.height = "auto"
      const height = `${field.scrollHeight}px`
      field.style.height = height === "0px" ? before : height
    })
  }

  changeBlockType(event) {
    const block = event.target.closest('[data-block-editor-target="block"]')
    const field = block.querySelector('textarea[data-field="text"]')
    if (!field || !["paragraph", "heading"].includes(block.dataset.type)) return
    const type = event.params.type
    if (type === "rich_text") {
      const content = field.value ? [{ type: "text", text: field.value }] : []
      this.replaceBlockWithBlocks(block, [{ type, data: { json: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content }] }) } }])
    } else {
      this.replaceBlockWithBlocks(block, [{ type, data: { text: field.value, level: event.params.level || 2 } }])
    }
  }

  toggleEmptyState() {
    if (!this.hasEmptyStateTarget) return
    this.emptyStateTarget.classList.toggle("hidden", this.blockTargets.length > 0)
  }
}
