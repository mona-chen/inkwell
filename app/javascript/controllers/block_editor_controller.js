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
  static targets = ["list", "block", "hiddenField", "blockPicker", "emptyState", "slashMenu", "saveStatus", "undoButton", "redoButton", "wordCount"]
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
    this.bindPickerOutsideClose()
    this.bindMarkdownPaste()
  }

  disconnect() {
    this.sortable?.destroy()
    this.hideSlashMenu()
    window.removeEventListener("mousedown", this._outsideClickHandler)
    this.listTarget.removeEventListener("paste", this._pasteHandler)
    if (this.saveTimer) clearTimeout(this.saveTimer)
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
    const copy = block.cloneNode(true)
    block.after(copy)
    this.commit()
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

  // Refresh the hidden field from the DOM, then record history. Every mutation must flow
  // through here so the form's hidden input always reflects the current block list —
  // otherwise deleting a block would leave the stale serialized value behind.
  commit() {
    this.hiddenFieldTarget.value = this.serializeValue()
    this.updateWordCount()
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
  replaceBlockWithBlocks(block, blocks) {
    const els = blocks.map((b) => this.buildBlockEl(b)).filter(Boolean)
    if (!els.length) return
    els.forEach((el) => block.before(el))
    block.remove()
    this.commit()
    this.toggleEmptyState()
    this.focusBlockField(els[0])
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

  // Live word count + reading time (~200 wpm), shown in the editor toolbar.
  updateWordCount() {
    if (!this.hasWordCountTarget) return
    const words = this.blockTargets.reduce((sum, el) => {
      el.querySelectorAll("[data-field]").forEach((f) => {
        // Skip hidden serialized fields (e.g. page_builder ERB) — count real text only.
        if (f.type === "textarea" || f.type === "text") {
          sum += (f.value || "").trim().split(/\s+/).filter(Boolean).length
        }
      })
      return sum
    }, 0)
    const minutes = Math.max(1, Math.ceil(words / 200))
    this.wordCountTarget.textContent = `${words.toLocaleString()} words · ${minutes} min read`
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
