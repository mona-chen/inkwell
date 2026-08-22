# Thin client for any OpenAI-compatible chat-completions API (OpenAI, Together, local
# Ollama/vLLM, etc). Base URL, model, and key come from site settings, with ENV fallbacks
# so a shared deployment can avoid storing the key in the database.
#
# Supports one-shot completions (AiWriter::Client#generate), SSE streaming
# (AiWriter::Client#stream_chat), and an OpenAI-style tool-calling loop
# (AiWriter::Client#stream_chat with `tools:` + `tool_executor:`) so the Copilot can call
# MCP research tools (e.g. the DesignMD design catalog) before it answers.
require "net/http"
require "json"

module AiWriter
  class Client
    DEFAULT_BASE_URL = "https://api.openai.com/v1"
    DEFAULT_MODEL = "gpt-4o-mini"
    MAX_TOOL_ROUNDS = 8

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
    # { role: "user"|"assistant", content: ... } turns. Yields either a plain string (content)
    # or a Hash { content: ... } / { reasoning_content: ... } so reasoning never pollutes the
    # final reply.
    #
    # When `tools` (OpenAI function schemas) and `tool_executor` (->(name, args) { text }) are
    # given, this runs a STREAMING tool-calling loop: reasoning and content stream live, tool
    # calls are accumulated from deltas, executed (the executor may stream updates), and the
    # loop repeats until the model answers.
    def stream_chat(messages, system: nil, tools: [], tool_executor: nil, &block)
      raise Error, "AI is not configured — open Copilot settings to add an API key." unless configured?
      raise ArgumentError, "stream_chat requires a block" unless block

      if tools.present? && tool_executor
        return stream_with_tools(messages, system: system, tools: tools, tool_executor: tool_executor, &block)
      end

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
            delta = parsed.dig("choices", 0, "delta") || {}
            block.call({ reasoning_content: delta["reasoning_content"] }) if delta["reasoning_content"]
            block.call({ content: delta["content"] }) if delta["content"]
          end
        end

        # Fallback: if nothing streamed but the body is a plain completion JSON, yield it.
        if raw.present? && !raw.include?("data:")
          message = JSON.parse(raw).dig("choices", 0, "message", "content") rescue nil
          block.call({ content: message }) if message.present?
        end
      end
    rescue Error
      raise
    rescue StandardError => e
      raise Error, e.message
    end

    # Streaming OpenAI-style tool-calling loop. Each round streams the model's reasoning and
    # content live; tool_call deltas are accumulated, then executed in order (the executor may
    # stream design updates), results feed back, and the loop repeats until the model answers.
    def stream_with_tools(messages, system:, tools:, tool_executor:, &block)
      all_messages = []
      all_messages << { role: "system", content: system } if system.present?
      all_messages.concat(messages)

      MAX_TOOL_ROUNDS.times do
        body = { model: model, messages: all_messages, tools: tools, stream: true }
        request = Net::HTTP::Post.new("/chat/completions")
        request["Content-Type"] = "application/json"
        request["Accept"] = "text/event-stream"
        request["Authorization"] = "Bearer #{api_key}"
        request.body = body.to_json

        tool_calls = nil
        tool_order = []
        content = +""
        http.request(request) do |response|
          unless response.is_a?(Net::HTTPSuccess)
            raise Error, "AI request failed (#{response.code}): #{response.body.to_s[0, 200]}"
          end

          raw = +""
          response.read_body do |chunk|
            raw << chunk
            chunk.each_line do |line|
              next unless line.start_with?("data:")

              data = line[5..].strip
              next if data == "[DONE]"

              parsed = JSON.parse(data) rescue next
              delta = parsed.dig("choices", 0, "delta") || {}
              block.call({ reasoning_content: delta["reasoning_content"] }) if delta["reasoning_content"]
              if delta["content"]
                content << delta["content"]
                block.call({ content: delta["content"] })
              end
              next unless delta["tool_calls"]

              # Providers stream tool_call deltas differently: some key fragments by `index`
              # (per tool), some increment `index` per delta and rely on a stable `id`, and
              # some omit `id`. Track BOTH an id→entry and index→entry map so fragments always
              # land on the same tool regardless of which key a chunk carries.
              tool_calls ||= { entries: [], by_id: {}, by_index: {} }
              delta["tool_calls"].each do |tc|
                entry = nil
                if tc["id"] && tool_calls[:by_id][tc["id"]]
                  entry = tool_calls[:by_id][tc["id"]]
                elsif tc["index"] && tool_calls[:by_index][tc["index"]]
                  entry = tool_calls[:by_index][tc["index"]]
                else
                  entry = { "id" => nil, "function" => { "name" => nil, "arguments" => +"" } }
                  tool_calls[:entries] << entry
                end
                if tc["id"]
                  tool_calls[:by_id][tc["id"]] = entry
                  entry["id"] ||= tc["id"]
                end
                if tc["index"]
                  tool_calls[:by_index][tc["index"]] = entry
                end
                next unless tc["function"]

                entry["function"]["name"] ||= tc["function"]["name"]
                entry["function"]["arguments"] << tc["function"]["arguments"].to_s
              end
            end
          end

          # Non-streaming fallback (provider ignores stream:true).
          if raw.present? && !raw.include?("data:")
            message = JSON.parse(raw).dig("choices", 0, "message") rescue nil
            if message
              tool_calls = { entries: [], by_id: {}, by_index: {} }
              if message["tool_calls"].present?
                message["tool_calls"].each do |c|
                  tool_calls[:entries] << { "id" => c["id"], "function" => { "name" => c.dig("function", "name"), "arguments" => c.dig("function", "arguments") || "" } }
                end
              end
              if message["content"].present?
                content << message["content"]
                block.call({ content: message["content"] })
              end
            end
          end
        end

        if tool_calls && (entries = tool_calls[:entries] || []).any?
          calls = entries.map do |tc|
            { "id" => tc["id"], "type" => "function", "function" => { "name" => tc["function"]["name"], "arguments" => tc["function"]["arguments"] } }
          end
          all_messages << { role: "assistant", content: content.presence, tool_calls: calls }
          calls.each do |call|
            fn = call["function"] || {}
            result = tool_executor.call(fn["name"], safe_parse(fn["arguments"]))
            all_messages << { role: "tool", tool_call_id: call["id"], content: result.to_s }
          end
          next
        end

        return
      end

      raise Error, "The model exceeded #{MAX_TOOL_ROUNDS} tool-calling rounds."
    end

    # ONE streaming round for the client-driven loop: stream reasoning + content deltas, then if
    # the model emits tool calls, yield { tool_calls: [...] } WITHOUT executing them (the client
    # executes them against the live builder store) and return the assistant message. The caller
    # appends this message to the session, relays the calls to the client, and resumes with the
    # tool results.
    def stream_round(messages, system: nil, tools: [], &block)
      all_messages = []
      all_messages << { role: "system", content: system } if system.present?
      all_messages.concat(messages)
      body = { model: model, messages: all_messages, tools: tools, stream: true }

      request = Net::HTTP::Post.new("/chat/completions")
      request["Content-Type"] = "application/json"
      request["Accept"] = "text/event-stream"
      request["Authorization"] = "Bearer #{api_key}"
      request.body = body.to_json

      tool_calls = nil
      content = +""
      http.request(request) do |response|
        unless response.is_a?(Net::HTTPSuccess)
          raise Error, "AI request failed (#{response.code}): #{response.body.to_s[0, 200]}"
        end

        raw = +""
        response.read_body do |chunk|
          raw << chunk
          chunk.each_line do |line|
            next unless line.start_with?("data:")

            data = line[5..].strip
            next if data == "[DONE]"

            parsed = JSON.parse(data) rescue next
            delta = parsed.dig("choices", 0, "delta") || {}
            block.call({ reasoning_content: delta["reasoning_content"] }) if delta["reasoning_content"]
            if delta["content"]
              content << delta["content"]
              block.call({ content: delta["content"] })
            end
            next unless delta["tool_calls"]

            tool_calls ||= { entries: [], by_id: {}, by_index: {} }
            delta["tool_calls"].each do |tc|
              entry = nil
              if tc["id"] && tool_calls[:by_id][tc["id"]]
                entry = tool_calls[:by_id][tc["id"]]
              elsif tc["index"] && tool_calls[:by_index][tc["index"]]
                entry = tool_calls[:by_index][tc["index"]]
              else
                entry = { "id" => nil, "function" => { "name" => nil, "arguments" => +"" } }
                tool_calls[:entries] << entry
              end
              if tc["id"]
                tool_calls[:by_id][tc["id"]] = entry
                entry["id"] ||= tc["id"]
              end
              if tc["index"]
                tool_calls[:by_index][tc["index"]] = entry
              end
              next unless tc["function"]

              entry["function"]["name"] ||= tc["function"]["name"]
              entry["function"]["arguments"] << tc["function"]["arguments"].to_s
            end
          end
        end

        # Non-streaming fallback (provider ignores stream:true).
        if raw.present? && !raw.include?("data:")
          message = JSON.parse(raw).dig("choices", 0, "message") rescue nil
          if message
            tool_calls = { entries: [], by_id: {}, by_index: {} }
            if message["tool_calls"].present?
              message["tool_calls"].each do |c|
                tool_calls[:entries] << { "id" => c["id"], "function" => { "name" => c.dig("function", "name"), "arguments" => c.dig("function", "arguments") || "" } }
              end
            end
            if message["content"].present?
              content << message["content"]
              block.call({ content: message["content"] })
            end
          end
        end
      end

      entries = tool_calls && tool_calls[:entries] || []
      calls = entries.map do |tc|
        { "id" => tc["id"], "type" => "function", "function" => { "name" => tc["function"]["name"], "arguments" => tc["function"]["arguments"] } }
      end
      if calls.any?
        block.call({ tool_calls: calls })
        return { role: "assistant", content: content.presence, tool_calls: calls }
      end

      { role: "assistant", content: content.presence }
    end

    private

    def safe_parse(string)
      JSON.parse(string.to_s)
    rescue JSON::ParserError
      {}
    end

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
