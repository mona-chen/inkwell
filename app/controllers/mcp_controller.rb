# Stateless, authenticated Streamable HTTP (JSON response mode). Session cookies
# never authenticate this endpoint; legacy content API tokens remain read-only.
class McpController < ActionController::API
  SUPPORTED_VERSIONS = %w[2025-06-18 2025-11-25].freeze
  MAX_BYTES = 1.megabyte
  before_action :authenticate_agent!

  def show
    response.headers["Allow"] = "POST"
    head :method_not_allowed
  end

  def create
    return head :unsupported_media_type unless request.media_type == "application/json"
    accept = request.headers["Accept"].to_s
    return head :not_acceptable unless accept.include?("application/json") && accept.include?("text/event-stream")
    version = request.headers["MCP-Protocol-Version"]
    return render_error(nil, -32600, "Unsupported protocol version", :bad_request) if version.present? && !SUPPORTED_VERSIONS.include?(version)
    raw = request.body.read(MAX_BYTES + 1)
    return head :payload_too_large if raw.bytesize > MAX_BYTES
    message = JSON.parse(raw)
    unless message.is_a?(Hash) && message["jsonrpc"] == "2.0" && message["method"].is_a?(String) && (!message.key?("id") || message["id"].is_a?(String) || message["id"].is_a?(Integer)) && (!message.key?("params") || message["params"].is_a?(Hash))
      return render_error(nil, -32600, "Invalid JSON-RPC request", :bad_request)
    end
    # Notifications never run tools or mutate site content.
    return head :accepted unless message.key?("id")
    id, args = message["id"], message.fetch("params", {})
    registry = AgentAccess::Registry.new(@credential)
    result = case message["method"]
    when "initialize"
      { protocolVersion: SUPPORTED_VERSIONS.include?(args["protocolVersion"]) ? args["protocolVersion"] : SUPPORTED_VERSIONS.last, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "inkwell", version: "1.0.0" }, instructions: "Work in drafts. Read versions before writing. Publishing and plugin activation require their own granted permissions. Builder workspace changes must be rendered and saved in the real editor before publishing. Refresh tools/list after plugin activation." }
    when "ping" then {}
    when "tools/list"
      return render_error(id, -32602, "Pagination cursors are unsupported") if args["cursor"].present?
      { tools: registry.tools.map(&:as_json) }
    when "tools/call"
      return render_error(id, -32602, "Expected tool name and object arguments") unless args["name"].is_a?(String) && args.fetch("arguments", {}).is_a?(Hash)
      registry.call(args["name"], args.fetch("arguments", {}))
    else
      return render_error(id, -32601, "Method not found")
    end
    render json: { jsonrpc: "2.0", id: id, result: result }
  rescue JSON::ParserError
    render_error(nil, -32700, "Invalid JSON", :bad_request)
  rescue StandardError => e
    Rails.logger.error("[MCP] #{e.class}: #{e.message}")
    render_error(message.is_a?(Hash) ? message["id"] : nil, -32603, "Internal error. Check the server log.", :internal_server_error)
  end

  private

  def authenticate_agent!
    response.headers["Cache-Control"] = "no-store"
    origin = request.headers["Origin"]
    return head :forbidden if origin.present? && origin != request.base_url
    site = Current.site || (Site.find_by(id: request.env["multisite.site_id"]) if request.env["multisite.site_id"]) || Site.find_by(is_default: true) || Site.first
    secret = request.headers["Authorization"].to_s[/\ABearer\s+(ink_agent_[A-Za-z0-9_-]+)\z/i, 1]
    @credential = site&.agent_credentials&.find_by(token_digest: Digest::SHA256.hexdigest(secret)) if secret
    unless @credential&.usable?
      response.headers["WWW-Authenticate"] = 'Bearer realm="Inkwell agents"'
      return head :unauthorized
    end
    @credential.update_column(:last_used_at, Time.current)
  end

  def render_error(id, code, message, status = :ok)
    render json: { jsonrpc: "2.0", id: id, error: { code: code, message: message } }, status: status
  end
end
