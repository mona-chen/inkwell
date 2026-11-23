import { Controller } from "@hotwired/stimulus"

// Spreadsheet-style editor for the table block. Columns/rows live in hidden JSON fields;
// the highlighted column in a hidden int field. Paste a range from Sheets/Excel (TSV) or
// CSV into any cell to fill the grid from that point. Tab/Enter move between cells.
export default class extends Controller {
  static targets = ["columns", "rows", "highlight", "grid"]
  static values = { maxColumns: { type: Number, default: 8 }, maxRows: { type: Number, default: 60 } }

  connect() {
    this.columns = this.parse(this.columnsTarget.value, ["Feature", "Option A", "Option B"])
    this.rows = this.parse(this.rowsTarget.value, [["", "", ""], ["", "", ""]])
    this.normalize()
    this.render()
  }

  parse(value, fallback) {
    try {
      const parsed = JSON.parse(value || "null")
      return Array.isArray(parsed) && parsed.length ? parsed : fallback
    } catch { return fallback }
  }

  get width() { return this.columns.length }
  get highlight() { return this.highlightTarget.value === "" ? null : parseInt(this.highlightTarget.value, 10) }

  normalize() {
    const width = Math.max(this.columns.length, ...this.rows.map((row) => row.length), 1)
    while (this.columns.length < width) this.columns.push("")
    this.rows = this.rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""))
  }

  write() {
    this.columnsTarget.value = JSON.stringify(this.columns)
    this.rowsTarget.value = JSON.stringify(this.rows)
    this.rowsTarget.dispatchEvent(new Event("input", { bubbles: true }))
  }

  render(focus = null) {
    const table = document.createElement("table")
    table.className = "ink-table-editor__grid"
    const head = table.createTHead().insertRow()
    head.insertCell().className = "ink-table-editor__corner"
    this.columns.forEach((name, col) => {
      const cell = document.createElement("th")
      cell.className = col === this.highlight ? "is-highlighted" : ""
      const tools = document.createElement("div")
      tools.className = "ink-table-editor__coltools"
      tools.append(
        this.tool(col === this.highlight ? "★" : "☆", col === this.highlight ? "Remove highlight" : "Highlight this column", () => this.toggleHighlight(col)),
        this.tool("←", "Move column left", () => this.moveColumn(col, -1), col === 0),
        this.tool("→", "Move column right", () => this.moveColumn(col, 1), col === this.width - 1),
        this.tool("×", "Delete column", () => this.removeColumn(col), this.width <= 1)
      )
      cell.append(tools, this.input(name, `Column ${col + 1} heading`, (value) => { this.columns[col] = value }, -1, col, true))
      head.append(cell)
    })
    const body = table.createTBody()
    this.rows.forEach((row, rowIndex) => {
      const tr = body.insertRow()
      const tools = tr.insertCell()
      tools.className = "ink-table-editor__rowtools"
      tools.append(
        this.tool("↑", "Move row up", () => this.moveRow(rowIndex, -1), rowIndex === 0),
        this.tool("↓", "Move row down", () => this.moveRow(rowIndex, 1), rowIndex === this.rows.length - 1),
        this.tool("×", "Delete row", () => this.removeRow(rowIndex), this.rows.length <= 1)
      )
      row.forEach((value, col) => {
        const td = tr.insertCell()
        td.className = col === this.highlight ? "is-highlighted" : ""
        td.append(this.input(value, `Row ${rowIndex + 1}, ${this.columns[col] || `column ${col + 1}`}`, (next) => { this.rows[rowIndex][col] = next }, rowIndex, col))
      })
    })
    this.gridTarget.replaceChildren(table)
    if (focus) this.gridTarget.querySelector(`[data-row="${focus.row}"][data-col="${focus.col}"]`)?.focus()
  }

  input(value, label, assign, row, col, header = false) {
    const input = document.createElement("input")
    input.type = "text"
    input.value = value
    input.className = header ? "ink-table-editor__input ink-table-editor__input--head" : "ink-table-editor__input"
    input.placeholder = header ? "Heading" : ""
    input.setAttribute("aria-label", label)
    input.dataset.row = row
    input.dataset.col = col
    input.addEventListener("input", (event) => { event.stopPropagation(); assign(input.value); this.write() })
    input.addEventListener("keydown", (event) => this.keydown(event, row, col))
    input.addEventListener("paste", (event) => this.paste(event, row, col))
    return input
  }

  tool(text, label, handler, disabled = false) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "ink-table-editor__tool"
    button.textContent = text
    button.title = label
    button.setAttribute("aria-label", label)
    button.disabled = disabled
    button.addEventListener("click", handler)
    return button
  }

  keydown(event, row, col) {
    event.stopPropagation()
    if (event.key === "Enter") {
      event.preventDefault()
      if (row === this.rows.length - 1 || event.metaKey || event.ctrlKey) this.addRow(row + 1, col)
      else this.focus(row + 1, col)
    } else if (event.key === "ArrowDown" && row < this.rows.length - 1) {
      event.preventDefault(); this.focus(row + 1, col)
    } else if (event.key === "ArrowUp" && row > -1) {
      event.preventDefault(); this.focus(row - 1, col)
    }
  }

  focus(row, col) {
    this.gridTarget.querySelector(`[data-row="${row}"][data-col="${col}"]`)?.focus()
  }

  // Multi-cell paste (TSV from spreadsheets, or CSV) fills the grid from the cursor.
  paste(event, row, col) {
    const text = event.clipboardData?.getData("text/plain") || ""
    if (!/[\t\n]/.test(text.trim()) && !(text.includes(",") && text.includes("\n"))) return
    event.preventDefault()
    const delimiter = text.includes("\t") ? "\t" : ","
    const matrix = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((line) => this.splitLine(line, delimiter))
    const startRow = row
    matrix.forEach((cells, offset) => {
      const targetRow = startRow + offset
      cells.forEach((cell, index) => {
        const targetCol = col + index
        if (targetCol >= this.maxColumnsValue) return
        while (this.columns.length <= targetCol) { this.columns.push(""); this.rows.forEach((r) => r.push("")) }
        if (targetRow === -1) { this.columns[targetCol] = cell; return }
        while (this.rows.length <= targetRow && this.rows.length < this.maxRowsValue) this.rows.push(Array(this.width).fill(""))
        if (this.rows[targetRow]) this.rows[targetRow][targetCol] = cell
      })
    })
    this.normalize()
    this.render({ row, col })
    this.write()
  }

  splitLine(line, delimiter) {
    if (delimiter === "\t") return line.split("\t").map((cell) => cell.trim())
    const cells = []
    let current = "", quoted = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"' && line[i + 1] === '"' && quoted) { current += '"'; i++ }
      else if (char === '"') quoted = !quoted
      else if (char === "," && !quoted) { cells.push(current.trim()); current = "" }
      else current += char
    }
    cells.push(current.trim())
    return cells
  }

  addRow(at = this.rows.length, col = 0) {
    if (this.rows.length >= this.maxRowsValue) return
    this.rows.splice(at, 0, Array(this.width).fill(""))
    this.render({ row: at, col: typeof col === "number" ? col : 0 })
    this.write()
  }

  addColumn() {
    if (this.width >= this.maxColumnsValue) return
    this.columns.push("")
    this.rows.forEach((row) => row.push(""))
    this.render({ row: -1, col: this.width - 1 })
    this.write()
  }

  removeRow(index) {
    this.rows.splice(index, 1)
    this.render()
    this.write()
  }

  removeColumn(index) {
    this.columns.splice(index, 1)
    this.rows.forEach((row) => row.splice(index, 1))
    const highlight = this.highlight
    if (highlight === index) this.setHighlight(null)
    else if (highlight !== null && highlight > index) this.setHighlight(highlight - 1)
    this.render()
    this.write()
  }

  moveRow(index, delta) {
    const target = index + delta
    ;[this.rows[index], this.rows[target]] = [this.rows[target], this.rows[index]]
    this.render({ row: target, col: 0 })
    this.write()
  }

  moveColumn(index, delta) {
    const target = index + delta
    const swap = (list) => { [list[index], list[target]] = [list[target], list[index]] }
    swap(this.columns)
    this.rows.forEach(swap)
    const highlight = this.highlight
    if (highlight === index) this.setHighlight(target)
    else if (highlight === target) this.setHighlight(index)
    this.render({ row: -1, col: target })
    this.write()
  }

  toggleHighlight(col) {
    this.setHighlight(this.highlight === col ? null : col)
    this.render()
    this.write()
  }

  setHighlight(value) {
    this.highlightTarget.value = value === null ? "" : String(value)
  }
}
