# Thin client for any OpenAI-compatible chat-completions API (OpenAI, Together, local
# Ollama/vLLM, etc). Base URL, model, and key come from site settings, with ENV fallbacks
# so a shared deployment can avoid storing the key in the database.
#
# Supports both one-shot completions (AiWriter::Client#generate) and SSE streaming
# (AiWriter::Client#stream_chat) so the Copilot can show thinking as it arrives.
require "net/http"
require "json"

module AiWriter
  class Client
    DEFAULT_BASE_URL = "https://api.openai.com/v1"
    DEFAULT_MODEL = "gpt-4o-mini"

    class Error < StandardError; end

    def initialize(site:)
      @site = site
    end

    def configured?
      api_key.present?
    end

    # One-shot completion. Returns the full text.
    def generate(prompt, system: nil)
      raise Error, "AI is not configured — open Copilot settings to add an API key." unless configured?

      messages = []
      messages << { role: "system", content: system } if system.present?
      messages << { role: "user", content: prompt }
      body = { model: model, messages: messages }

      response = http.post("/chat/completions", body.to_json, "Content-Type" => "application/json", "Authorization" => "Bearer #{api_key}")
      unless response.is_a?(Net::HTTPSuccess)
        raise Error, "AI request failed (#{response.code}): #{response.body.to_s[0, 200]}"
      end

      JSON.parse(response.body).dig("choices", 0, "message", "content").to_s.strip
    rescue Error
      raise
    rescue StandardError => e
      raise Error, e.message
    end

    # Streaming completion over a full conversation. `messages` is an array of
    # { role: "user"|"assistant", content: ... } turns; yields each content delta (and, for
    # reasoning models, the reasoning delta via `reasoning_content`) as it arrives.
    def stream_chat(messages, system: nil, &block)
      raise Error, "AI is not configured — open Copilot settings to add an API key." unless configured?
      raise ArgumentError, "stream_chat requires a block" unless block

      all_messages = []
      all_messages << { role: "system", content: system } if system.present?
      all_messages.concat(messages)
      body = { model: model, messages: all_messages, stream: true }

      request = Net::HTTP::Post.new("/chat/completions")
      request["Content-Type"] = "application/json"
      request["Accept"] = "text/event-stream"
      request["Authorization"] = "Bearer #{api_key}"
      request.body = body.to_json

      http.request(request) do |response|
        unless response.is_a?(Net::HTTPSuccess)
          raise Error, "AI request failed (#{response.code}): #{response.body.to_s[0, 200]}"
        end

        # Some OpenAI-compatible providers ignore `stream: true` and return a normal JSON
        # body. Accumulate the raw body so we can fall back to parsing it below.
        raw = +""
        response.read_body do |chunk|
          raw << chunk
          chunk.each_line do |line|
            next unless line.start_with?("data:")

            data = line[5..].strip
            next if data == "[DONE]"

            parsed = JSON.parse(data) rescue next
            delta = parsed.dig("choices", 0, "delta", "content") ||
                    parsed.dig("choices", 0, "delta", "reasoning_content")
            block.call(delta) if delta
          end
        end

        # Fallback: if nothing streamed but the body is a plain completion JSON, yield it.
        if raw.present? && !raw.include?("data:")
          message = JSON.parse(raw).dig("choices", 0, "message", "content") rescue nil
          block.call(message) if message.present?
        end
      end
    rescue Error
      raise
    rescue StandardError => e
      raise Error, e.message
    end

    private

    def base_url
      (@site.setting("ai_base_url").presence || ENV["OPENAI_BASE_URL"] || DEFAULT_BASE_URL).to_s.sub(%r{/+\z}, "")
    end

    def model
      @site.setting("ai_model").presence || ENV["OPENAI_MODEL"] || DEFAULT_MODEL
    end

    def api_key
      @site.setting("ai_api_key").presence || ENV["OPENAI_API_KEY"]
    end

    def http
      @http ||= begin
        uri = URI.parse(base_url)
        net = Net::HTTP.new(uri.host, uri.port)
        net.use_ssl = uri.scheme == "https"
        net.open_timeout = 60
        net.read_timeout = 300
        net
      end
    end
  end
end
