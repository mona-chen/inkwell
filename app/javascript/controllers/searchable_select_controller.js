import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["fallback", "enhanced", "source", "trigger", "value", "panel", "search", "list", "empty"]

  connect() {
    this.fallbackTarget.hidden = true
    this.enhancedTarget.hidden = false
    this.activeIndex = -1
    this.sync()
  }

  disconnect() {
    this.fallbackTarget.hidden = false
    this.enhancedTarget.hidden = true
  }

  sync() {
    const selected = this.sourceTarget.selectedOptions[0]
    this.valueTarget.textContent = selected?.textContent || "Choose an option"
    this.triggerTarget.classList.toggle("has-value", !!this.sourceTarget.value)
    this.triggerTarget.removeAttribute("aria-invalid")
    if (!this.panelTarget.hidden) this.filter()
  }

  toggle() { this.panelTarget.hidden ? this.open() : this.close(true) }
  open() {
    this.panelTarget.hidden = false
    this.triggerTarget.setAttribute("aria-expanded", "true")
    this.searchTarget.value = ""
    this.filter()
    this.searchTarget.focus()
  }
  close(restoreFocus = false) {
    this.panelTarget.hidden = true
    this.triggerTarget.setAttribute("aria-expanded", "false")
    this.searchTarget.removeAttribute("aria-activedescendant")
    if (restoreFocus) this.triggerTarget.focus()
  }
  outside(event) { if (!this.element.contains(event.target)) this.close() }
  invalid(event) {
    event.preventDefault()
    this.open()
    this.triggerTarget.setAttribute("aria-invalid", "true")
  }

  filter() {
    const query = this.searchTarget.value.trim().toLowerCase()
    this.options = Array.from(this.sourceTarget.options).filter(option => option.value && option.textContent.toLowerCase().includes(query))
    this.listTarget.replaceChildren()
    this.options.forEach((option, index) => {
      const row = document.createElement("button")
      row.type = "button"
      row.role = "option"
      row.tabIndex = -1
      row.id = `${this.listTarget.id}_${index}`
      row.setAttribute("aria-selected", String(option.value === this.sourceTarget.value))
      row.className = "ink-searchable-select-option"
      const name = document.createElement("span")
      name.textContent = option.textContent.split(" · ")[0]
      const branch = document.createElement("small")
      branch.textContent = option.dataset.defaultBranch || ""
      row.append(name, branch)
      row.addEventListener("click", () => this.choose(index))
      this.listTarget.append(row)
    })
    this.emptyTarget.hidden = this.options.length > 0
    this.activeIndex = this.options.findIndex(option => option.value === this.sourceTarget.value)
    if (this.activeIndex < 0 && this.options.length) this.activeIndex = 0
    this.highlight()
  }

  choose(index) {
    const option = this.options[index]
    if (!option) return
    this.sourceTarget.value = option.value
    this.sourceTarget.dispatchEvent(new Event("input", { bubbles: true }))
    this.sourceTarget.dispatchEvent(new Event("change", { bubbles: true }))
    this.close(true)
  }

  highlight() {
    Array.from(this.listTarget.children).forEach((row, index) => row.classList.toggle("is-highlighted", index === this.activeIndex))
    const row = this.listTarget.children[this.activeIndex]
    if (row) {
      this.searchTarget.setAttribute("aria-activedescendant", row.id)
      const list = this.listTarget
      const top = row.offsetTop - list.offsetTop
      if (top < list.scrollTop) list.scrollTop = top
      else if (top + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + row.offsetHeight - list.clientHeight
    } else this.searchTarget.removeAttribute("aria-activedescendant")
  }

  keydown(event) {
    if (event.key === "Tab") { this.close(); return }
    if (event.key === "Escape" && !this.panelTarget.hidden) { event.preventDefault(); event.stopPropagation(); this.close(true); return }
    if (this.panelTarget.hidden) {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); this.open() }
      return
    }
    if (event.key === "Enter") { event.preventDefault(); this.choose(this.activeIndex); return }
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return
    event.preventDefault()
    if (!this.options.length) return
    const direction = event.key === "ArrowDown" ? 1 : -1
    this.activeIndex = (this.activeIndex + direction + this.options.length) % this.options.length
    this.highlight()
  }
}
