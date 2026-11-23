import { Controller } from "@hotwired/stimulus"

// Live preview for the author profile editor: mirrors name, title, bio and avatar into the
// byline/author-box preview, and reveals extra link rows on demand.
export default class extends Controller {
  static targets = ["nameInput", "titleInput", "bioInput", "name", "nameSmall", "title", "bio", "avatarSmall", "avatarLarge", "avatarId", "linkRow"]

  update() {
    const name = this.nameInputTarget.value.trim() || "Your name"
    this.nameTarget.textContent = name
    this.nameSmallTarget.textContent = name
    this.titleTarget.textContent = this.titleInputTarget.value.trim()
    this.bioTarget.textContent = this.bioInputTarget.value.trim() || "Add a short bio so readers know who is behind the story."
    if (!this.avatarIdTarget.value) this.renderInitials(name)
  }

  // The media picker swaps its own preview; copy the chosen image into both previews.
  avatar() {
    requestAnimationFrame(() => {
      const chosen = this.element.querySelector(".profile-avatar__image img")
      if (chosen && this.avatarIdTarget.value) {
        for (const target of [this.avatarSmallTarget, this.avatarLargeTarget]) {
          const image = document.createElement("img")
          image.src = chosen.src
          image.alt = ""
          image.className = "h-full w-full object-cover"
          target.replaceChildren(image)
        }
      } else {
        this.renderInitials(this.nameInputTarget.value)
      }
    })
  }

  renderInitials(name) {
    const initials = (name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?"
    for (const target of [this.avatarSmallTarget, this.avatarLargeTarget]) {
      if (target.querySelector("img") && this.avatarIdTarget.value) continue
      const span = document.createElement("span")
      span.className = "profile-initials"
      span.textContent = initials
      target.replaceChildren(span)
    }
  }

  addLink() {
    const hidden = this.linkRowTargets.find((row) => row.hidden)
    if (!hidden) return
    hidden.hidden = false
    hidden.querySelector('input[name$="[url]"]')?.focus()
  }
}
