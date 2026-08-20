import { Controller } from "@hotwired/stimulus"
import Sortable from "sortablejs"

// Drag-reorder for the menu builder. On drop, PATCHes each item's new position in sequence —
// deliberately simple (N requests, not a single batch endpoint) because menus are tiny (a
// handful of items) and this keeps the server-side action a plain `update`, reusable by any
// future non-drag reordering UI (keyboard up/down, for accessibility) without a special
// batch-reorder route.
export default class extends Controller {
  static targets = ["list", "item"]
  static values = { menuId: Number }

  connect() {
    this.sortable = Sortable.create(this.listTarget, {
      handle: "span.cursor-grab",
      animation: 150,
      onEnd: () => this.persistOrder(),
    })
  }

  disconnect() {
    this.sortable?.destroy()
  }

  async persistOrder() {
    const token = document.querySelector('meta[name="csrf-token"]')?.content

    this.itemTargets.forEach((el, index) => {
      fetch(`/admin/menus/${this.menuIdValue}/menu_items/${el.dataset.itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({ menu_item: { position: index } }),
      })
    })
  }
}
