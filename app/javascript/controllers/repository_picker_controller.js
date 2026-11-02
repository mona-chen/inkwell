import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["branch"]
  select(event) {
    const branch = event.target.selectedOptions[0]?.dataset.defaultBranch
    if (branch && this.hasBranchTarget) {
      this.branchTarget.value = branch
      this.branchTarget.dispatchEvent(new Event("change", { bubbles: true }))
    }
  }
}
