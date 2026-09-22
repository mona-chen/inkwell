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

    # A tool call's arguments arrive as a stream of JSON fragments. When the provider stops early —
    # its output limit, a dropped connection — the fragments end mid-payload and JSON.parse fails.
    # Falling back to `{}` there is a lie that costs a whole round: "the model sent nothing" and
    # "the payload was cut in half" need OPPOSITE corrections ("fill it in" vs. "split the work"),
    # so the model resends the same oversized payload and the user watches an unchanged page. The
    # evidence is kept and handed back as a tool result instead.
    TOOL_ARGUMENT_TAIL = 120

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
        raise Error, failure_message(response)
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
          raise Error, failure_message(response)
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
        finish_reason = nil
        http.request(request) do |response|
          unless response.is_a?(Net::HTTPSuccess)
            raise Error, failure_message(response)
          end

          raw = +""
          response.read_body do |chunk|
            raw << chunk
            chunk.each_line do |line|
              next unless line.start_with?("data:")

              data = line[5..].strip
              next if data == "[DONE]"

              parsed = JSON.parse(data) rescue next
              choice = parsed.dig("choices", 0) || {}
              # Why the provider stopped is part of the diagnosis: `length` means the response —
              # and therefore any tool payload inside it — was cut off at the output limit.
              finish_reason = choice["finish_reason"] if choice["finish_reason"].present?
              delta = choice["delta"] || {}
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
            payload = JSON.parse(raw) rescue nil
            finish_reason ||= payload&.dig("choices", 0, "finish_reason")
            message = payload&.dig("choices", 0, "message")
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
            parsed = self.class.parse_tool_arguments(fn["arguments"])
            # A cut payload becomes a correction the model reads on the next round, never a silent
            # `{}` that makes the builder look like it rejected a perfectly reasonable call.
            result = if parsed[:ok]
              tool_executor.call(fn["name"], parsed[:value])
            else
              self.class.argument_failure_message(fn["name"], parsed, finish_reason: finish_reason)
            end
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
      finish_reason = nil
      http.request(request) do |response|
        unless response.is_a?(Net::HTTPSuccess)
          raise Error, failure_message(response)
        end

        raw = +""
        buffer = +""
        process_sse_line = lambda do |line|
          next unless line.start_with?("data:")

          data = line[5..].strip
          next if data.blank? || data == "[DONE]"

          parsed = JSON.parse(data) rescue next
          choice = parsed.dig("choices", 0) || {}
          finish_reason = choice["finish_reason"] if choice["finish_reason"].present?
          delta = choice["delta"] || {}
          block.call({ reasoning_content: delta["reasoning_content"] }) if delta["reasoning_content"]
          if delta["content"]
            content << delta["content"]
            block.call({ content: delta["content"] })
          end
          next unless delta["tool_calls"]

          tool_calls ||= { entries: [], by_id: {}, by_index: {} }
          delta["tool_calls"].each do |tc|
            entry = if tc["id"] && tool_calls[:by_id][tc["id"]]
              tool_calls[:by_id][tc["id"]]
            elsif !tc["index"].nil? && tool_calls[:by_index][tc["index"]]
              tool_calls[:by_index][tc["index"]]
            else
              created = { "id" => nil, "function" => { "name" => nil, "arguments" => +"" } }
              tool_calls[:entries] << created
              created
            end
            if tc["id"]
              tool_calls[:by_id][tc["id"]] = entry
              entry["id"] ||= tc["id"]
            end
            tool_calls[:by_index][tc["index"]] = entry unless tc["index"].nil?
            next unless tc["function"]

            entry["function"]["name"] ||= tc["function"]["name"]
            entry["function"]["arguments"] << tc["function"]["arguments"].to_s
          end
        end
        response.read_body do |chunk|
          raw << chunk
          buffer << chunk
          while (newline = buffer.index("\n"))
            process_sse_line.call(buffer.slice!(0, newline + 1).delete_suffix("\n").delete_suffix("\r"))
          end
        end
        process_sse_line.call(buffer) if buffer.present?

        # Non-streaming fallback (provider ignores stream:true).
        if raw.present? && !raw.include?("data:")
          payload = JSON.parse(raw) rescue nil
          finish_reason ||= payload&.dig("choices", 0, "finish_reason")
          message = payload&.dig("choices", 0, "message")
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
      # `finish_reason` is carried on the returned message so the caller can explain a payload that
      # the provider cut off. The caller strips it before appending the message to the session: an
      # unknown key on an assistant turn is not something every OpenAI-compatible provider accepts.
      if calls.any?
        block.call({ tool_calls: calls })
        return { role: "assistant", content: content.presence, tool_calls: calls, finish_reason: finish_reason }
      end

      { role: "assistant", content: content.presence, finish_reason: finish_reason }
    end

    # Evidence about one tool call's arguments, so a failure can be described instead of guessed at.
    #   reason — :ok, :empty (nothing arrived), :unparseable (arrived, but is not valid JSON),
    #            :not_an_object (valid JSON that is not an argument object)
    # Never raises: the caller turns a failure into a tool result the model reads in the same request.
    def self.parse_tool_arguments(raw)
      text = raw.to_s
      return { ok: false, reason: :empty, bytes: 0, tail: "", value: nil } if text.strip.empty?

      value = JSON.parse(text)
      unless value.is_a?(Hash)
        return { ok: false, reason: :not_an_object, bytes: text.bytesize, tail: argument_tail(text), value: nil }
      end

      { ok: true, reason: :ok, bytes: text.bytesize, tail: "", value: value }
    rescue JSON::ParserError
      { ok: false, reason: :unparseable, bytes: text.bytesize, tail: argument_tail(text), value: nil }
    end

    # Where a payload stopped, so a person reading the tool result can see it mid-value. `Slice` with a
    # negative start returns nil past the beginning of the string, which would quietly report "nothing
    # arrived" for a short payload, so the short case is handled here rather than by an index.
    def self.argument_tail(text)
      text.length > TOOL_ARGUMENT_TAIL ? text[-TOOL_ARGUMENT_TAIL..] : text
    end
    private_class_method :argument_tail

    # The correction, in the model's own terms. A payload that never arrived and a payload that was
    # cut in half take opposite fixes, and guessing wrong burns a round, so the message says which
    # one happened, how much arrived, and what to do instead of resending the same call.
    def self.argument_failure_message(name, problem, finish_reason: nil)
      tool = name.to_s.presence || "The tool call"
      stopped = finish_reason.to_s == "length" ? ", and the provider stopped at its output limit (finish_reason: length)" : ""
      evidence = problem[:bytes].to_i.positive? ? " (#{problem[:bytes]} bytes arrived, ending with #{problem[:tail].to_s.inspect}#{stopped})" : ""

      case problem[:reason]
      when :empty
        "#{tool} was called with NO arguments#{evidence}, so NOTHING changed and repeating this call " \
          "as-is cannot work. Call #{tool} again with the full arguments. If the payload is large, do " \
          "not send it in one call: get_capabilities reports the per-call node limit " \
          "(composition.maximumNodes) and one section per append_tree call stays under it."
      when :not_an_object
        "#{tool} received JSON that is not an argument object#{evidence}, so the call was discarded " \
          "and NOTHING changed. Send the arguments as an object with the named fields."
      else
        "#{tool} arguments are not valid JSON#{evidence}, so the call was discarded and NOTHING " \
          "changed. A payload that stops mid-write was cut off, not composed wrong: do NOT resend the " \
          "same call. Split the work into smaller calls — one section per append_tree call, each under " \
          "the composition.maximumNodes limit from get_capabilities."
      end
    end

    private

    # A provider's refusal always says what is actually wrong — "The supported API model names
    # are … but you passed …", "Incorrect API key provided", "maximum context length is …" — and
    # that one sentence is the only useful thing in the body. Embedding the raw JSON instead
    # buries it: the editor sees an error blob and can only advise "try again", which is exactly
    # the wrong advice when the fix is a setting. So the provider's own words are lifted out and
    # whatever is left is trimmed to something a person can read in a chat bubble.
    def failure_message(response)
      body = response.body.to_s
      parsed = begin
        JSON.parse(body)
      rescue JSON::ParserError
        nil
      end
      # OpenAI-compatible providers disagree on the shape: { error: { message } }, { error: "…" },
      # or { message: "…" }.
      detail = if parsed.is_a?(Hash)
        error = parsed["error"]
        (error.is_a?(Hash) ? error["message"] : error).presence || parsed["message"].presence
      end
      detail = body.strip[0, 300].presence unless detail.is_a?(String) && detail.present?
      "AI request failed (#{response.code}): #{detail.presence || 'the provider gave no reason.'}"
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
