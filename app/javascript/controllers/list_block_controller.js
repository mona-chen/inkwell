import { Controller } from "@hotwired/stimulus"

// Keeps a list block honest while it is being edited: authors write one item per line,
// while the adjacent preview is always a real <ul>/<ol> with real <li> children. The same
// structure is emitted by Blocks::ListComponent on the published page.
export default class extends Controller {
  static targets = ["items", "preview"]

  connect() {
    this.render()
  }

  render() {
    const ordered = this.element.querySelector('[data-field="ordered"]')?.checked
    const list = document.createElement(ordered ? "ol" : "ul")
    list.className = ordered ? "content-list content-list--ordered" : "content-list content-list--unordered"

    const items = this.itemsTarget.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    items.forEach((item) => {
      const listItem = document.createElement("li")
      listItem.textContent = item
      list.appendChild(listItem)
    })

    if (items.length) {
      this.previewTarget.replaceChildren(list)
    } else {
      const empty = document.createElement("p")
      empty.className = "text-xs text-muted-foreground"
      empty.textContent = "Add one item per line to preview the list."
      this.previewTarget.replaceChildren(empty)
    }
  }
}
