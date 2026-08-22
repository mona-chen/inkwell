# Minial JSON-RPC client for an MCP (Model Context Protocol) server over the Streamable HTTP
# transport — enough for tool discovery and calls (e.g. the DesignMD design-research catalog).
#
# The server is stateless for our purposes: `initialize` / `notifications/initialized` are
# exchanged for spec-compliance, but subsequent `tools/list` and `tools/call` requests carry
# the Authorization header on every POST, so no session bookkeeping is required.
require "net/http"
require "json"

module AiWriter
  class McpClient
    DEFAULT_URL = "https://www.designmd.co/api/mcp"

    class Error < StandardError; end

    def initialize(url: nil, token: nil)
      @url = (url.presence || DEFAULT_URL)
      @token = token.to_s
      @id = 0
    end

    # The server's tools as OpenAI-style function schemas, ready to hand to the model.
    def tools
      initialize_session
      result = rpc("tools/list", {})
      Array(result["tools"]).map do |tool|
        {
          "type" => "function",
          "function" => {
            "name" => tool["name"],
            "description" => tool["description"].to_s,
            "parameters" => tool["inputSchema"] || {}
          }
        }
      end
    end

    # Execute a tool and return its text output. Raises on transport/auth/JSON errors; callers
    # are expected to rescue and surface the message as the tool's result.
    def call(name, arguments = {})
      initialize_session
      result = rpc("tools/call", { "name" => name, "arguments" => arguments || {} })
      text = Array(result["content"]).map { |part| part["text"] || part.to_json }.join("\n")
      raise Error, "MCP tool #{name} failed: #{text[0, 500]}" if result["isError"]

      text.presence || "(no output)"
    end

    private

    def initialize_session
      return if @initialized

      rpc("initialize", {
            "protocolVersion" => "2025-03-26",
            "capabilities" => {},
            "clientInfo" => { "name" => "inkwell", "version" => "1.0" }
          })
      # Notification (no response expected) — tolerate servers that 4xx it.
      begin
        post(notification("notifications/initialized"))
      rescue StandardError
        nil
      end
      @initialized = true
    end

    def rpc(method, params)
      data = post(payload(method, params))
      if data["error"]
        raise Error, data["error"]["message"].to_s
      end
      data["result"] || {}
    end

    def payload(method, params)
      @id += 1
      { "jsonrpc" => "2.0", "id" => @id, "method" => method, "params" => params }
    end

    def notification(method)
      { "jsonrpc" => "2.0", "method" => method }
    end

    def post(body)
      uri = URI.parse(@url)
      request = Net::HTTP::Post.new(uri.request_uri)
      request["Content-Type"] = "application/json"
      request["Accept"] = "application/json, text/event-stream"
      request["Authorization"] = "Bearer #{@token}" if @token.present?
      request.body = body.to_json

      response = nil
      Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
        http.open_timeout = 30
        http.read_timeout = 60
        response = http.request(request)
      end

      # Follow redirects (designmd.co → www.designmd.co) so either host works in settings.
      if response.is_a?(Net::HTTPRedirection) && response["location"].present?
        @url = URI.join(@url, response["location"]).to_s
        return post(body)
      end

      unless response.is_a?(Net::HTTPSuccess)
        raise Error, "MCP request failed (#{response.code}): #{response.body.to_s[0, 200]}"
      end

      JSON.parse(response.body)
    rescue JSON::ParserError
      raise Error, "Invalid MCP response: #{response.body.to_s[0, 200]}"
    rescue Error
      raise
    rescue StandardError => e
      raise Error, "MCP connection failed: #{e.message}"
    end
  end
end
