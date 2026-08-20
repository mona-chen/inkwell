import { Controller } from "@hotwired/stimulus"

// Tiny utility controller: submits the enclosing form the moment a file is picked, so the
// media library upload is a single click instead of "choose file" -> "click upload".
export default class extends Controller {
  submit() {
    this.element.requestSubmit()
  }
}
