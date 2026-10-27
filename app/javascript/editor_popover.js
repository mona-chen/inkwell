// Shared viewport geometry for the application-owned editor surfaces.
export function placeEditorPopover(element, anchor, { above = false, maxHeight = 320 } = {}) {
  const viewport = window.visualViewport
  const left = viewport?.offsetLeft || 0
  const top = viewport?.offsetTop || 0
  const width = viewport?.width || window.innerWidth
  const height = viewport?.height || window.innerHeight
  const margin = 12, gap = 8
  element.style.position = "fixed"
  element.style.width = `${Math.min(element.dataset.popoverWidth || 280, width - margin * 2)}px`
  element.style.maxWidth = `${width - margin * 2}px`
  const upper = Math.max(0, anchor.top - top - margin - gap)
  const lower = Math.max(0, top + height - margin - anchor.bottom - gap)
  const naturalHeight = Math.min(element.scrollHeight, maxHeight)
  const opensAbove = above ? upper >= naturalHeight || upper > lower : lower < naturalHeight && upper > lower
  const room = opensAbove ? upper : lower
  element.style.maxHeight = `${Math.max(40, Math.min(maxHeight, room))}px`
  const bounds = element.getBoundingClientRect()
  const x = Math.max(left + margin, Math.min(anchor.left, left + width - margin - bounds.width))
  const y = opensAbove ? anchor.top - gap - bounds.height : anchor.bottom + gap
  element.style.left = `${x}px`
  element.style.top = `${Math.max(top + margin, Math.min(y, top + height - margin - bounds.height))}px`
  element.dataset.placement = opensAbove ? "above" : "below"
}
