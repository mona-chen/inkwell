import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const source = await readFile(new URL('../app/javascript/editor_popover.js', import.meta.url), 'utf8')
const { placeEditorPopover } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
function popover(height = 400) {
  return { dataset: {}, style: {}, scrollHeight: height,
    getBoundingClientRect() { return { width: parseFloat(this.style.width), height: Math.min(height, parseFloat(this.style.maxHeight)) } } }
}
test('a menu near the viewport bottom flips above its anchor', () => {
  globalThis.window = { innerWidth: 900, innerHeight: 600 }
  const element = popover()
  placeEditorPopover(element, { left: 500, top: 540, bottom: 560 })
  assert.equal(element.dataset.placement, 'above')
  assert.ok(parseFloat(element.style.top) >= 12)
  assert.ok(parseFloat(element.style.top) + element.getBoundingClientRect().height <= 532)
})
test('narrow viewports constrain both width and horizontal position', () => {
  globalThis.window = { innerWidth: 240, innerHeight: 600 }
  const element = popover()
  placeEditorPopover(element, { left: 225, top: 120, bottom: 140 })
  assert.ok(parseFloat(element.style.left) >= 12)
  assert.ok(parseFloat(element.style.left) + element.getBoundingClientRect().width <= 228)
})
test('an on-screen keyboard limits the menu to the visible viewport', () => {
  globalThis.window = { innerWidth: 900, innerHeight: 900, visualViewport: { width: 360, height: 260, offsetTop: 100, offsetLeft: 0 } }
  const element = popover(700)
  placeEditorPopover(element, { left: 330, top: 270, bottom: 290 })
  const bounds = element.getBoundingClientRect()
  assert.ok(parseFloat(element.style.top) >= 112)
  assert.ok(parseFloat(element.style.top) + bounds.height <= 348)
  assert.ok(parseFloat(element.style.left) + bounds.width <= 348)
})
