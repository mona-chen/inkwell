import { Controller } from "@hotwired/stimulus"

// A small repeatable-row editor for structured blocks (takeaways, FAQ, stats, pros/cons).
// The source of truth is one hidden `data-field-format="json"` input (the `field` target);
// rows are rendered from it and every edit writes it back and bubbles an `input` event so
// the block editor serializes, autosaves and records undo history as usual.
//
//   data-item-list-fields-value='[{"key":"question","label":"Question"},{"key":"answer","label":"Answer","multiline":true}]'
//   (omit fields for a plain list of strings)
export default class extends Controller {
  static targets = ["field", "rows"]
  static values = { fields: Array, placeholder: String, max: { type: Number, default: 50 }, min: { type: Number, default: 1 }, addLabel: { type: String, default: "Add item" } }

  connect() {
    this.items = this.read()
    if (this.items.length < this.minValue) this.items = Array.from({ length: this.minValue }, () => this.blank())
    this.render()
  }

  read() {
    try {
      const value = JSON.parse(this.fieldTarget.value || "[]")
      return Array.isArray(value) ? value : []
    } catch {
      return this.fieldTarget.value.split("\n").filter(Boolean)
    }
  }

  get structured() { return this.fieldsValue.length > 0 }

  blank() {
    return this.structured ? Object.fromEntries(this.fieldsValue.map((field) => [field.key, ""])) : ""
  }

  write() {
    const clean = this.items.filter((item) => this.structured ? Object.values(item).some((value) => String(value).trim()) : String(item).trim())
    this.fieldTarget.value = JSON.stringify(clean)
    this.fieldTarget.dispatchEvent(new Event("input", { bubbles: true }))
  }

  render(focus = null) {
    this.rowsTarget.replaceChildren(...this.items.map((item, index) => this.row(item, index)))
    const adder = document.createElement("button")
    adder.type = "button"
    adder.className = "ink-items__add"
    adder.textContent = `+ ${this.addLabelValue}`
    adder.hidden = this.items.length >= this.maxValue
    adder.addEventListener("click", () => this.add())
    this.rowsTarget.append(adder)
    if (focus !== null) this.rowsTarget.querySelectorAll(".ink-items__row")[focus]?.querySelector("input, textarea")?.focus()
  }

  row(item, index) {
    const row = document.createElement("div")
    row.className = "ink-items__row"
    const fields = document.createElement("div")
    fields.className = this.structured ? `ink-items__fields ink-items__fields--${this.fieldsValue.length}` : "ink-items__fields"
    const specs = this.structured ? this.fieldsValue : [{ key: null, label: this.placeholderValue || "Item", multiline: false }]
    specs.forEach((spec) => {
      const input = document.createElement(spec.multiline ? "textarea" : "input")
      if (!spec.multiline) input.type = "text"
      else input.rows = 2
      input.className = `ink-items__input${spec.multiline ? " ink-items__input--multiline" : ""}${spec.strong ? " ink-items__input--strong" : ""}`
      input.placeholder = spec.placeholder || spec.label
      input.setAttribute("aria-label", `${spec.label} ${index + 1}`)
      input.value = spec.key ? (item?.[spec.key] ?? "") : (item ?? "")
      input.addEventListener("input", (event) => {
        event.stopPropagation()
        if (spec.key) this.items[index] = { ...this.items[index], [spec.key]: input.value }
        else this.items[index] = input.value
        if (input.tagName === "TEXTAREA") { input.style.height = "auto"; input.style.height = `${input.scrollHeight}px` }
        this.write()
      })
      input.addEventListener("keydown", (event) => this.keydown(event, index, spec))
      fields.append(input)
    })
    row.append(fields)
    const actions = document.createElement("div")
    actions.className = "ink-items__actions"
    actions.append(
      this.action("↑", "Move up", () => this.move(index, -1), index === 0),
      this.action("↓", "Move down", () => this.move(index, 1), index === this.items.length - 1),
      this.action("×", "Remove", () => this.remove(index), this.items.length <= this.minValue)
    )
    row.append(actions)
    return row
  }

  action(text, label, handler, disabled) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "ink-items__action"
    button.textContent = text
    button.title = label
    button.setAttribute("aria-label", label)
    button.disabled = disabled
    button.addEventListener("click", handler)
    return button
  }

  keydown(event, index, spec) {
    // Enter on a single-line field adds the next row (like a bullet list).
    if (event.key === "Enter" && !event.shiftKey && event.target.tagName === "INPUT") {
      event.preventDefault()
      event.stopPropagation()
      const lastField = !this.structured || spec.key === this.fieldsValue.at(-1).key
      if (lastField || !this.structured) this.add(index + 1)
      else event.target.nextElementSibling?.focus()
    }
    if (event.key === "Backspace" && event.target.value === "" && this.items.length > this.minValue && !this.structured) {
      event.preventDefault()
      event.stopPropagation()
      this.remove(index, Math.max(0, index - 1))
    }
  }

  add(at = this.items.length) {
    if (this.items.length >= this.maxValue) return
    this.items.splice(at, 0, this.blank())
    this.render(at)
    this.write()
  }

  remove(index, focus = null) {
    this.items.splice(index, 1)
    this.render(focus)
    this.write()
  }

  move(index, delta) {
    const target = index + delta
    if (target < 0 || target >= this.items.length) return
    ;[this.items[index], this.items[target]] = [this.items[target], this.items[index]]
    this.render(target)
    this.write()
  }
}
