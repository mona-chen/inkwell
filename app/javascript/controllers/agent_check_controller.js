import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["status"]
  static values = { endpoint: String }

  async check(event) {
    const button = event.currentTarget
    const token = this.element.parentElement.querySelector('[data-agent-secret="true"]')?.value
    if (!token) return

    button.disabled = true
    this.statusTarget.textContent = "Checking credential…"
    try {
      const response = await fetch(this.endpointValue, {
        method: "POST",
        credentials: "omit",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream"
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
      })
      const data = response.ok ? await response.json() : null
      if (!Array.isArray(data?.result?.tools)) throw new Error(`MCP returned HTTP ${response.status}`)
      this.statusTarget.textContent = `Connected. This credential can access ${data.result.tools.length} tools.`
    } catch {
      this.statusTarget.textContent = "Connection failed. Check the server URL and credential."
    } finally {
      button.disabled = false
    }
  }
}
