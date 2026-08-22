module AiWriter
  # Copilot's chat endpoint. Streams an SSE response from the provider so the widget can show
  # thinking as it happens, then the client parses the model's { reply, actions } JSON and
  # executes any edit operations against the block editor. The API key never leaves the server.
  class CompletionsController < Admin::BaseController
    include ActionController::Live

    # In-memory session store for the client-driven (CopilotTools) loop. The design lives in the
    # browser; the server only carries the model's message history between rounds. Single-process
    # is fine for this app; entries expire and are pruned lazily.
    CLIENT_SESSIONS = {}
    SESSION_TTL = 600
    MAX_CLIENT_ROUNDS = 16

    def self.prune_sessions
      now = Time.now
      CLIENT_SESSIONS.delete_if { |_, s| now - (s[:created_at] || now) > SESSION_TTL }
    end

    # Instructs the model to chat conversationally and, only when the user asks to change the
    # document, return edit operations. Keep this in lockstep with the client-side executor
    # in app/views/ai_writer/_editor_toolbar.html.erb.
    COPILOT_SYSTEM_PROMPT = <<~PROMPT
      You are Copilot, a conversational editing assistant inside a CMS block editor. Chat with
      the user naturally. When the user asks you to write, rewrite, or change the document,
      ALSO return edit operations.

      The document is a JSON array of blocks. Supported block types and their data:
      - heading: { level: 1-4, text }
      - paragraph: { text }
      - image: { url, alt, caption }
      - quote: { text, attribution }
      - list: { ordered: bool, items: "line one\\nline two" }
      - code: { language, code }
      - separator: {}
      - callout: { tone: "info|success|warning|danger", text }
      - button: { style: "primary|secondary", label, url }
      - rich_text: { json: a TipTap doc like {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hi","marks":[{"type":"bold"}]}]}]} }

      The user's mode tells you what they want:
      - draft: write NEW content for their request and append it.
      - continue: continue the document naturally and append.
      - rewrite_page: replace the ENTIRE document.
      - improve: improve the existing document.

      Respond with ONLY valid JSON (no markdown fences, no commentary, no trailing text):
      {"reply":"your conversational reply (plain text)","actions":[
        {"op":"append_blocks","blocks":[...]},
        {"op":"rewrite_page","blocks":[...]},
        {"op":"replace_range","start":0,"end":3,"blocks":[...]},
        {"op":"update_block","index":2,"data":{...}},
        {"op":"remove_blocks","start":1,"count":2}
      ]}
      "actions" is OPTIONAL — include it only when the user asks to change the document, and
      then "reply" should briefly confirm what you changed. Use existing block data shapes
      exactly. Prefer rich_text blocks for bold, italic, or links. Keep heading levels
      consistent with the document.
    PROMPT

    def create
      client = AiWriter::Client.new(site: Current.site)
      unless client.configured?
        render json: { error: "Copilot is not configured — add an API key in Settings → Copilot." }, status: :unprocessable_entity
        return
      end
      render json: { markdown: client.generate(build_prompt) }
    rescue AiWriter::Client::Error => e
      render json: { error: e.message }, status: :unprocessable_entity
    end

    # Streaming chat. Writes SSE events to the response; closes the stream in an ensure so a
    # provider error still terminates the connection.
    def chat
      client = AiWriter::Client.new(site: Current.site)
      unless client.configured?
        stream_json(error: "Copilot is not configured — add an API key in Settings → Copilot.")
        return
      end

      response.headers["Content-Type"] = "text/event-stream"

      # Client-driven mode: the design lives in the browser (builder.copilotTools). The server
      # relays the model's tool calls to the client, which executes them against the live store
      # and POSTs results back via tool_result to resume the loop.
      if params[:clientTools]
        self.class.prune_sessions
        session_id = SecureRandom.hex(8)
        CLIENT_SESSIONS[session_id] = {
          messages: [ { role: "user", content: client_build_prompt } ],
          system: client_system_prompt,
          tools: parse_client_tools,
          rounds: 0,
          created_at: Time.now
        }
        run_client_round(client, session_id, [])
        return
      end

      # A working copy of the current design that the editing tools mutate server-side. When
      # any editing tool runs, the updated spec streams back as a "design" event after the reply.
      # The page's current custom CSS/JS seed the copy so precision edits (css_edit) build on
      # the existing stylesheet instead of replacing it.
      design = AiWriter::Design.new(
        Array(params[:currentSections]),
        custom_css: params[:customCss].to_s,
        custom_js: params[:customJs].to_s
      )
      design_dirty = false
      mcp_configured = mcp_enabled? && mcp_token.present?
      mcp_client = mcp_configured ? AiWriter::McpClient.new(url: mcp_url, token: mcp_token) : nil
      executor = lambda do |name, arguments|
        # Stream the tool turn so the widget can show what the AI is doing, subtly.
        stream_json(tool: { name: name.to_s, args: arguments })
        if EDITING_TOOL_NAMES.include?(name.to_s)
          design_dirty = true
          design.apply_tool(name, arguments)
          # Live editing: stream the updated design right after each edit tool so the canvas
          # morphs in real time as the model works, instead of waiting for the whole reply.
          stream_json(design: design.to_spec)
          "ok — design now has #{design.sections.length} sections"
        elsif READ_TOOL_NAMES.include?(name.to_s)
          design.apply_tool(name, arguments) # read-only: returns data, never mutates
        elsif mcp_client
          mcp_client.call(name, arguments)
        else
          "unknown tool: #{name}"
        end
      rescue StandardError => e
        "MCP tool error: #{e.message}"
      end

      tools = EDITING_TOOL_SCHEMAS + READ_TOOL_SCHEMAS + mcp_tools

      # Phase 1 — BUILD. The model creates the design (via editing tools and/or the marked-text
      # format). For the page builder we buffer the raw content so it's not shown verbatim; the
      # design is streamed as a "design" event instead.
      build_content = +""
      client.stream_chat(build_messages, system: system_prompt, tools: tools, tool_executor: executor) do |piece|
        if piece.is_a?(Hash)
          stream_json(choice: { delta: piece }) unless piece[:content] && params[:env] == "html"
          build_content << piece[:content].to_s if piece[:content]
        else
          stream_json(choice: { delta: { content: piece } })
          build_content << piece.to_s
        end
      end

      # If the build came back as a marked-text design (no editing tools ran), the server parses
      # it so the design state is authoritative — and streamed as a design event, not raw text.
      if spec = AiWriter::DesignSpec.parse(build_content)
        design = AiWriter::Design.new(spec["elementLists"], custom_css: spec["customCss"], custom_js: spec["customJs"])
        design_dirty = true
        stream_json(design: design.to_spec)
        reply = spec["reply"].presence
        stream_json(choice: { delta: { content: reply } }) if reply
      elsif build_content.present? && params[:env] != "html"
        stream_json(choice: { delta: { content: build_content } })
      end

      # Phase 2 — REVIEW & REFINE (agentic loop). For whole-page work (design/rewrite) we hand the
      # just-built design back to the model with the editing tools and a critique instruction. It
      # reads, criticises, and refines via tools (each edit streams live to the canvas) until it's
      # satisfied, then confirms. Targeted edits (add_section / surgical) skip the review so the
      # AI never second-guesses a precise instruction.
      if design_dirty && design.sections.any? && %w[design rewrite].include?(params[:mode])
        client.stream_chat(review_messages(design), system: REVIEW_SYSTEM_PROMPT, tools: tools, tool_executor: executor) do |piece|
          payload = piece.is_a?(Hash) ? piece : { content: piece }
          stream_json(choice: { delta: payload })
        end
      end

      stream_done
    rescue ActionController::Live::ClientDisconnected, IOError
      # The editor may cancel or navigate during a slow provider stream. Closing the browser
      # connection is an expected control flow, not an application error.
    rescue AiWriter::Client::Error => e
      stream_json(error: e.message)
    ensure
      response.stream.close
    end

    # Default element formats every builder element carries — teach the model the exact
    # shape so generated stores load cleanly into the Ink Builder.
    BUILDER_DEFAULT_FORMATS = {
      "font_size" => nil, "link_color" => nil, "text_align" => "center", "text_color" => nil,
      "font_family" => nil, "line_height" => nil, "padding_top" => 0, "padding_left" => 0,
      "padding_right" => 0, "letter_spacing" => nil, "padding_bottom" => 0,
      "text_direction" => "left_to_right", "background_size" => "100%",
      "background_color" => nil, "background_image" => nil, "background_repeat" => "no-repeat",
      "paragraph_spacing" => nil, "background_position" => "center"
    }.freeze

    # Page Builder (env: html) — the whole canvas is Copilot's playground. It designs
    # complete, elegant layouts as a builder-native store (real elements the Ink Builder can
    # load and edit). The model replies in a simple marked-text format (NOT JSON) that the
    # widget parses into a compact spec and completes with the exact formats client-side —
    # far more reliable than asking a reasoning model to emit JSON.
    PAGE_BUILDER_SYSTEM_PROMPT = <<~PROMPT
      You are Copilot, a conversational design assistant inside Inkwell's visual Page Builder
      (Ink Builder). The builder canvas is an HTML playground — you design complete, elegant
      pages as builder-native elements so the result is fully editable in the canvas.

      CHAT FIRST: respond naturally to the user like an assistant. Only design when they
      actually ask you to design, build, rewrite, or add to the page. For greetings, questions,
      or small talk, reply with just: REPLY: <your conversational answer> and nothing else.

      PLAN BEFORE IMPLEMENTING: when you design, your REPLY is a PROPOSAL — the user reviews
      it and approves before it's applied to the canvas.

      When you design, reply in THIS EXACT plain-text format (NO JSON, NO markdown fences,
      NO commentary outside it):

      REPLY: one-sentence summary of the proposed design
      BG: <optional section background color, e.g. #f8f9fa>
      H5: <small label>
      H1: <headline>
      P: <paragraph>
      BUTTON: <button label>
      LIST: item one | item two | item three

      - Each new "BG:" line starts a new section; use H5/H1/P/BUTTON/LIST lines freely within
        a section. Sections without a BG default to white.
      - Design an elegant page: a hero (H5 + H1 + P + BUTTON), a values / three-feature
        section (H5 + P per feature), and a closing CTA (H1 + P + BUTTON).
      - Use real, specific copy for the page's topic based on the PAGE TITLE and SITE NAME in
        the request — never lorem ipsum and never invent a hardcoded topic.
      - You may use {{ site.name }} and {{ page.title }} tokens inside the text.
      - COLOR IS THEME-LEVEL, NOT PER-ELEMENT: text/typography colors follow the .cp-* vocabulary
        (driven by the --pb-* tokens in the page's CSS), so pick a palette ONCE and express it as
        a final CSS: block of --pb-* tokens (see the token list in the CSS section below). Dark
        sections (BG: #0b0f1a etc.) automatically get light text — do NOT add per-line colors.
        Never rely on the default blue/purple palette.
      - Keep it concise.

      MAGIC DESIGN KIT (make it look premium, not templated): use these section markers to
      compose modern, animated-feeling layouts. Use them deliberately, not everywhere. When you
      use a gradient or aurora, ALWAYS pick colors that fit the page's topic/mood (never the
      default blue-purple):
        AURORA: <bg>|<from>|<to>   section with an animated aurora backdrop; give it two colors
        GRADIENT: <from>|<to>|<title>   a headline with a gradient; give it two colors
        SHIMMER: <title>    a headline with a light shimmer sweep (great on dark sections)
        MARQUEE: Acme | Linear | Vercel   a scrolling logo/brand marquee
        BENTO:              makes the section's cards a bento grid
        CARD: title | body | wide|tall     a bento card (optional wide/tall span)
        SPOTCARD: title | body   a spotlight card (soft hover glow)
        STATS:              makes the section a stats band
        STAT: 99.9% | Uptime   one stat number + label
        EFFECT: grid|dots   adds a grid or dot background pattern to the section
      Example hero: "BG: #0b0f1a / AURORA: #0b0f1a|#22d3ee|#a78bfa / GRADIENT: #22d3ee|#a78bfa|Build
      something people remember / P: ... / BUTTON: Get started". Pick a distinct palette per
      page — emerald/teal, warm amber/rose, cool cyan/violet — and match the dark/light scheme.
      Prefer variety — don't make every section an eyebrow + cards + button.

      EDITING: you have page tools. Reading tools (read_design, read_section, read_element,
      read_css) let you inspect the CURRENT design and its styling precisely — use them to see
      exact indices or a CSS rule before changing it. Editing tools (edit_element, edit_section,
      add_element, remove_element, add_section, remove_section, move_section, set_custom_css,
      set_custom_js, css_edit) change the design. When the user asks to change, add, remove, or
      restyle part of the CURRENT design, CALL the tools — do not emit text edits and do not
      redesign the page. Use the CURRENT DESIGN (grep-style index in the request) to target exact
      0-indexed sections/elements. For styling, use css_edit(selector, property, value) to change
      a single token/rule (e.g. css_edit(':root', '--cp-accent', '#5e6ad2')) without touching the
      rest of the stylesheet. Call as many tools as needed; the server applies them and returns the
      updated design, then reply with a one-line confirmation of what changed. Use the full design
      format (REPLY:/BG:/H1:/…) only for a whole-page build or explicit
      "rewrite / design from scratch" requests.
    PROMPT

    # Appended to the system prompt when an MCP research server (DesignMD) is configured.
    # The model discovers the tool schemas from the request; this tells it WHY/HOW to use them.
    RESEARCH_HINT = <<~HINT
      DESIGN RESEARCH: You have access to a design-research tool server (DesignMD). Before you
      propose a design, USE its tools to ground your work in real, tasteful design systems:
      search_designs(query) to find a matching brand/aesthetic or mood, get_design(slug) or
      get_full_system(slug) for a system's colors/typography/spacing, generate_css_variables(slug)
      for ready-made design tokens, compare_designs(slug_a, slug_b) to weigh two directions, and
      search_patterns(query) or search_blocks(query) for component patterns. Call the tools, then
      weave the fetched design language (palette, type, spacing) into your proposal so it looks
      like a considered, on-brand design rather than generic defaults. Never claim research you
      didn't actually perform.
    HINT

    # Design skills loaded from the MCP server and appended to the system prompt for builder
    # (env=html) design requests, so the model follows the DesignMD methodology and design
    # fundamentals (accessibility, spacing, typography) on every design — not just when it
    # remembers to call a tool.
    RESEARCH_SKILLS = %w[designmd fundamentals].freeze

    # The Copilot's page-editing tools. These are executed SERVER-SIDE against a working copy of
    # the current design (AiWriter::Design); after the tool loop the updated spec streams back to
    # the widget, which re-renders the canvas. Sections and elements are 0-indexed.
    EDITING_TOOL_SCHEMAS = [
      {
        "type" => "function",
        "function" => {
          "name" => "edit_element",
          "description" => "Change one property of a specific element in the current design. Sections and elements are 0-indexed. field is 'text' (the visible copy) or 'align' ('left' or 'center').",
          "parameters" => {
            "type" => "object",
            "properties" => {
              "section" => { "type" => "integer", "description" => "0-indexed section number" },
              "element" => { "type" => "integer", "description" => "0-indexed element index within the section" },
              "field" => { "type" => "string", "enum" => %w[text align] },
              "value" => { "type" => "string" }
            },
            "required" => %w[section element field value]
          }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "edit_section",
          "description" => "Change a section-level property of the current design. Currently supports field 'bg' (background color, e.g. '#f8f9fa'). Section is 0-indexed.",
          "parameters" => {
            "type" => "object",
            "properties" => {
              "section" => { "type" => "integer" },
              "field" => { "type" => "string", "enum" => %w[bg] },
              "value" => { "type" => "string" }
            },
            "required" => %w[section field value]
          }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "add_element",
          "description" => "Append a new element to a section's elements. type is one of H5, H1, P, BUTTON, LIST, IMG, DIVIDER, GRADIENT (gradient-text title), SHIMMER (shimmer title), MARQUEE (items separated by |), BENTOCARD (title|body|wide/tall), SPOTCARD (title|body), STAT (number|label). For LIST separate items with newlines. Use align 'left' for paragraph-like elements.",
          "parameters" => {
            "type" => "object",
            "properties" => {
              "section" => { "type" => "integer", "description" => "0-indexed section" },
              "type" => { "type" => "string", "enum" => %w[H5 H1 P BUTTON LIST IMG DIVIDER GRADIENT SHIMMER MARQUEE BENTOCARD SPOTCARD STAT] },
              "text" => { "type" => "string" },
              "align" => { "type" => "string", "enum" => %w[left center] }
            },
            "required" => %w[section type text]
          }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "remove_element",
          "description" => "Remove an element from a section. Both indices are 0-indexed.",
          "parameters" => {
            "type" => "object",
            "properties" => {
              "section" => { "type" => "integer" },
              "element" => { "type" => "integer" }
            },
            "required" => %w[section element]
          }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "add_section",
          "description" => "Insert a new section into the current design. elements is an array of {type, text, align}. 'after' is the 0-indexed section to insert after; omit it or use -1 to append at the end. Use this to add a section (e.g. testimonials, pricing, FAQ) without touching existing sections.",
          "parameters" => {
            "type" => "object",
            "properties" => {
              "bg" => { "type" => "string", "description" => "Background color, e.g. '#f8f9fa'" },
              "elements" => {
                "type" => "array",
                "items" => {
                  "type" => "object",
                  "properties" => {
                    "type" => { "type" => "string", "enum" => %w[H5 H1 P BUTTON LIST IMG DIVIDER] },
                    "text" => { "type" => "string" },
                    "align" => { "type" => "string", "enum" => %w[left center] }
                  },
                  "required" => %w[type text]
                }
              },
              "after" => { "type" => "integer", "description" => "0-indexed section to insert after; -1 (or omitted) appends" }
            },
            "required" => [ "elements" ]
          }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "remove_section",
          "description" => "Remove a whole section from the current design. 0-indexed.",
          "parameters" => {
            "type" => "object",
            "properties" => { "section" => { "type" => "integer" } },
            "required" => %w[section]
          }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "move_section",
          "description" => "Move a section to a new position. Both indices are 0-indexed; position is 'before' or 'after' the target section.",
          "parameters" => {
            "type" => "object",
            "properties" => {
              "section" => { "type" => "integer" },
              "target" => { "type" => "integer" },
              "position" => { "type" => "string", "enum" => %w[before after] }
            },
            "required" => %w[section target position]
          }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "set_custom_css",
          "description" => "Set the page-level custom CSS (e.g. design tokens like :root { --cp-accent: #5e6ad2; }). Replaces any previous custom CSS.",
          "parameters" => {
            "type" => "object",
            "properties" => { "css" => { "type" => "string" } },
            "required" => %w[css]
          }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "set_custom_js",
          "description" => "Set the page-level custom JavaScript. Replaces any previous custom JS.",
          "parameters" => {
            "type" => "object",
            "properties" => { "js" => { "type" => "string" } },
            "required" => %w[js]
          }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "css_edit",
          "description" => "Precisely edit the page's custom CSS: set ONE property on a selector (e.g. ':root' → '--cp-accent', or '.cp-btn' → 'background'). If the selector already exists it updates that declaration (adding it if missing); if it doesn't exist a new rule is appended. Everything else in the stylesheet is untouched.",
          "parameters" => {
            "type" => "object",
            "properties" => {
              "selector" => { "type" => "string", "description" => "CSS selector, e.g. ':root' or '.cp-btn-primary'" },
              "property" => { "type" => "string", "description" => "CSS property, e.g. '--cp-accent' or 'background'" },
              "value" => { "type" => "string", "description" => "New value, e.g. '#5e6ad2'" }
            },
            "required" => %w[selector property value]
          }
        }
      }
    ].freeze

    EDITING_TOOL_NAMES = EDITING_TOOL_SCHEMAS.map { |s| s["function"]["name"] }.freeze

    # Read-only tools: let the model inspect the current design / CSS precisely before editing.
    # They return data but never mutate the design, so no "design" event is streamed for them.
    READ_TOOL_SCHEMAS = [
      {
        "type" => "function",
        "function" => {
          "name" => "read_design",
          "description" => "Return the current design as a readable, line-numbered index (sections, element text, section backgrounds). Use this before editing to see the exact structure and indices.",
          "parameters" => { "type" => "object", "properties" => {} }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "read_section",
          "description" => "Return one section of the current design: its background and every element (0-indexed).",
          "parameters" => {
            "type" => "object",
            "properties" => { "section" => { "type" => "integer", "description" => "0-indexed section" } },
            "required" => %w[section]
          }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "read_element",
          "description" => "Return one element's properties (name, template, text, align). Sections and elements are 0-indexed.",
          "parameters" => {
            "type" => "object",
            "properties" => {
              "section" => { "type" => "integer" },
              "element" => { "type" => "integer" }
            },
            "required" => %w[section element]
          }
        }
      },
      {
        "type" => "function",
        "function" => {
          "name" => "read_css",
          "description" => "Return the page's custom CSS rule(s) matching a selector (e.g. ':root' or '.cp-btn'). Pass '*' or an empty selector to return the whole stylesheet. Use this before css_edit to see what's there.",
          "parameters" => {
            "type" => "object",
            "properties" => { "selector" => { "type" => "string", "description" => "CSS selector, or '*' for the whole stylesheet" } }
          }
        }
      }
    ].freeze

    READ_TOOL_NAMES = READ_TOOL_SCHEMAS.map { |s| s["function"]["name"] }.freeze

    # Resume a client-driven Copilot loop after the browser executed a batch of tools against the
    # live builder store. Appends the tool results to the session and streams the next model turn.
    def tool_result
      client = AiWriter::Client.new(site: Current.site)
      unless client.configured?
        render json: { error: "Copilot is not configured — add an API key in Settings → Copilot." }, status: :unprocessable_entity
        return
      end
      response.headers["Content-Type"] = "text/event-stream"
      run_client_round(client, params[:session_id].to_s, Array(params[:results]))
    rescue ActionController::Live::ClientDisconnected, IOError
      CLIENT_SESSIONS.delete(params[:session_id].to_s)
    rescue AiWriter::Client::Error => e
      stream_json(error: e.message)
    ensure
      response.stream.close
    end

    private

    # One round of the client-driven loop: run the model, stream deltas, append the assistant
    # message; if it emitted tool calls, stream them as a "tools" event for the browser to execute.
    def run_client_round(client, session_id, results)
      session = CLIENT_SESSIONS[session_id]
      unless session
        stream_json(error: "Copilot session expired — send your request again.")
        stream_done
        return
      end
      session[:created_at] = Time.now
      session[:rounds] = session.fetch(:rounds, 0) + 1
      if session[:rounds] > MAX_CLIENT_ROUNDS
        CLIENT_SESSIONS.delete(session_id)
        stream_json(error: "Copilot reached the design-round limit. The applied changes are safe; send a focused follow-up to continue.")
        stream_done
        return
      end
      results.each do |result|
        session[:messages] << { role: "tool", tool_call_id: result["id"].to_s, content: result["content"].to_s }
      end
      assistant = client.stream_round(session[:messages], system: session[:system], tools: session[:tools]) do |piece|
        stream_json(choice: { delta: piece }) unless piece[:tool_calls]
      end
      session[:messages] << assistant
      if assistant[:tool_calls]&.any?
        calls = assistant[:tool_calls].map do |call|
          arguments = call.dig("function", "arguments")
          arguments = JSON.parse(arguments) if arguments.is_a?(String)
          { "id" => call["id"], "name" => call.dig("function", "name"), "arguments" => arguments || {} }
        rescue JSON::ParserError
          { "id" => call["id"], "name" => call.dig("function", "name"), "arguments" => {} }
        end
        stream_json(tools: { session_id: session_id, calls: calls })
      else
        CLIENT_SESSIONS.delete(session_id)
      end
      stream_done
    end

    def client_build_prompt
      parts = []
      parts << "Page title: #{params[:context]}" if params[:context].to_s.present?
      parts << "Site name: #{params[:site]}" if params[:site].to_s.present?
      parts << "Task mode: #{params[:mode]}"
      parts << "Requested design language: #{params[:brand]}" if params[:brand].to_s.present?
      parts << "Current design (numbered tree — target elements by their [path] or id):\n#{params[:designIndex].to_s}"
      history = Array(params[:history]).last(6).filter_map do |entry|
        next unless entry.respond_to?(:[])
        role = entry[:role] || entry["role"]
        content = entry[:content] || entry["content"]
        "#{role}: #{content.to_s[0, 500]}" if role.present? && content.present?
      end
      parts << "Recent conversation:\n#{history.join("\n")}" if history.any?
      parts << "User request: #{params[:prompt]}"
      parts.join("\n\n")
    end

    def client_system_prompt
      prompt = <<~PROMPT
        You are Inkwell Copilot: an expert product designer, art director, conversion copywriter,
        interaction designer, and front-end engineer embedded in a professional visual page
        builder. The page is LIVE in the browser. Tools are the only way to change it. Every
        visible result must remain a real, editable builder tree; custom CSS and JavaScript are
        an enhancement layer, never a substitute for editable content.

        OPERATING CONTRACT
        1. For any build, rewrite, or add-section request, call get_capabilities first. Never
           invent element types or setting names. For a surgical edit, call read_design and
           read_element/read_custom_code as needed. In design/rewrite mode the current tree is
           already in the user message; do not spend another round reading it.
        2. For a standard marketing, product, portfolio, service, or waitlist page, call
           compose_landing_page immediately after capability discovery. Fill its compact creative
           blueprint with original, specific copy and a deliberate palette. It expands to native
           editable builder primitives and responsive CSS. Use low-level replace_page only for a
           genuinely non-standard composition. Never build a page through dozens of insert calls.
           In add_section mode use append_tree once.
        3. After the canvas renders, call audit_design. Correct every error and meaningful
           warning with precise tools, then audit again. Do not claim completion without a final
           audit. Tool errors are feedback: correct the payload and continue.
        4. Finish with one concise sentence naming what was built. Do not expose implementation
           chatter, JSON, tool names, or a design critique to the user.

        QUALITY BAR — THE OUTPUT MUST LOOK ART-DIRECTED, NOT AI-GENERIC
        - Start from the product, audience, promise, and desired action. Write specific credible
          copy; no lorem ipsum or vague "revolutionize your workflow" language. Never invent
          numeric outcomes, client names, dates, years of experience, availability, testimonials,
          or customer logos. When facts are unknown, use honest qualitative proof, describe the
          kind of engagement without naming a fake client, and leave clearly editable labels.
        - Establish one visual concept with a restrained palette, type scale, spacing rhythm,
          border/radius language, and image/motion strategy. Avoid default blue-purple gradients,
          bland white cards, equal-width card monotony, and gratuitous glassmorphism.
        - Compose 5–7 purposeful sections for a landing page: navigation/identity when useful,
          a decisive hero, concrete product proof or visual demonstration, differentiated
          benefits, trust/proof, objection handling, and a closing CTA/footer. Vary density and
          silhouette; use asymmetry, editorial whitespace, bento layouts, or full-bleed moments
          only when they support the concept.
        - Use exactly one H1. Keep body copy readable (normally 16–20px), lines around 55–75
          characters, touch targets at least 44px, visible focus styles, semantic links/buttons,
          useful alt text, and sufficient contrast.
        - Design desktop, tablet, and mobile deliberately. Mobile must stack cleanly with sane
          edge padding, no fixed widths, no horizontal overflow, and type/spacing that scale.
        - Prefer container/section primitives for structure and native heading, paragraph,
          button, image, icon, list, testimonial, accordion, tabs, video, and data elements for
          content. Use Magic elements as accents or demonstrations, not as wallpaper.

        CUSTOM CSS / JS
        - Give important nodes memorable CSS classes through their cssClasses setting and scope
          page CSS under .ink-canvas-root. Use CSS custom properties for the page palette and
          clamp() for fluid display type and spacing. Preserve the builder's editor overlays.
        - Motion must honor prefers-reduced-motion and should clarify hierarchy. JavaScript must
          be idempotent, scoped to the current canvas, resilient when rerun, and dependency-free
          unless the request truly needs an available browser API. Shaders/WebGL/canvas effects
          are welcome when conceptually justified, with a graceful CSS fallback and no blocked
          interaction or unreadable text.
        - Never fetch unknown remote scripts, use eval, overwrite the builder runtime, or make
          page content depend on JavaScript. CSS and JS must also work in published output.

        MODE DISCIPLINE
        - design/rewrite: replace the whole page only when that is what the mode/request means.
        - add_section: preserve the current page and append one complete, coherent section.
        - targeted requests: preserve unrelated work and use path/id edits.
      PROMPT
      prompt += "\n\nThe user selected the #{params[:brand]} design language. Interpret its recognizable principles without copying trademarks or proprietary assets." if params[:brand].to_s.present?
      # Browser-owned tools are the complete callable surface for client mode. MCP research
      # tools execute only in the server-owned agent path; advertising them here makes the
      # model issue calls the browser cannot fulfil and stalls an otherwise valid design run.
      prompt
    end

    def parse_client_tools
      raw = params[:tools]
      parsed = raw.is_a?(String) ? JSON.parse(raw) : raw
      Array(parsed).filter_map do |tool|
        next unless tool.respond_to?(:[]) && tool["name"].to_s.match?(/\A[a-z][a-z0-9_]*\z/)
        {
          type: "function",
          function: {
            name: tool["name"],
            description: tool["description"].to_s[0, 1000],
            parameters: tool["parameters"].presence || { type: "object", properties: {} }
          }
        }
      end
    rescue JSON::ParserError
      []
    end

    # MCP design-research tools (DesignMD). Enabled via Settings → Copilot; the URL and bearer
    # token are stored in site settings and never sent to the browser. Any MCP failure just
    # disables the tools for this request rather than breaking the chat.
    def mcp_enabled?
      Current.site.setting("mcp_enabled") == "1"
    end

    def mcp_url
      Current.site.setting("mcp_url").presence || AiWriter::McpClient::DEFAULT_URL
    end

    def mcp_token
      Current.site.setting("mcp_token").presence
    end

    def mcp_tools
      return [] unless mcp_enabled? && mcp_token.present?

      @mcp_tools ||= AiWriter::McpClient.new(url: mcp_url, token: mcp_token).tools
    rescue StandardError
      []
    end

    def system_prompt
      base = params[:env] == "html" ? PAGE_BUILDER_SYSTEM_PROMPT : COPILOT_SYSTEM_PROMPT
      return base unless mcp_enabled?

      parts = [ base, RESEARCH_HINT ]
      parts << research_skills if params[:env] == "html"
      parts.join("\n\n")
    end

    # The DesignMD methodology + fundamentals skills, loaded from the MCP server once per
    # request. Any failure degrades to "no skills" rather than breaking the chat.
    def research_skills
      return "" unless mcp_enabled? && mcp_token.present?

      @research_skills ||= begin
        client = AiWriter::McpClient.new(url: mcp_url, token: mcp_token)
        RESEARCH_SKILLS.map do |name|
          text = client.call("get_skill", { "name" => name }).to_s
          "\n\n## Design skill: #{name}\n#{text[0, 3000]}"
        end.join
      rescue StandardError
        ""
      end
    end

    # Proactively research a requested brand's design system (its DESIGN.md + CSS tokens) and
    # hand it to the model, so a brand-aesthetic design is deterministic even if the model never
    # calls a tool. Also instructs the model to emit those tokens as --cp-* overrides so the
    # whole page re-themes. Degrades to a one-line instruction if the research fails.
    def design_language_block(brand)
      client = AiWriter::McpClient.new(url: mcp_url, token: mcp_token)
      summary = client.call("get_design", { "slug" => brand }).to_s[0, 2200]
      tokens = client.call("generate_css_variables", { "slug" => brand }).to_s[0, 2200]
      <<~PROMPT
        DESIGN WITH THE AESTHETIC OF "#{brand}". Its design system:
        #{summary}

        Its design tokens (CSS custom properties):
        #{tokens}

        Design the page in #{brand}'s visual language — palette, typography, spacing, mood.
        The builder's .cp-* vocabulary is tokenized (--pb-*): override the tokens on :root and
        the whole page re-themes. Emit a final CSS: block (after the design sections) mapping this
        brand into the tokens, e.g.:
        CSS:
        :root {
          --pb-accent: <accent hex>;
          --pb-accent-2: <secondary hex>;
          --pb-text: <text hex>;
          --pb-muted: <muted hex>;
          --pb-lead: <body text hex>;
          --pb-surface: <background hex>;
          --pb-dark: <dark section hex>;
          --pb-card: <card surface hex>;
          --pb-border: <border color>;
          --pb-font: "<display typeface>";
          --pb-btn-bg: <button background hex>;
          --pb-btn-text: <button text hex>;
        }
        Keep it concise; reuse var(--pb-*) in BG: values where it helps (e.g. BG: var(--pb-dark)).
      PROMPT
    rescue StandardError => e
      "Design with the aesthetic of #{brand}."
    end

    # A readable, grep-style index of the current design so the model can target exact
    # sections/elements for precision edits (same formatter as the read_design tool).
    def design_index(sections)
      AiWriter::Design.new(Array(sections)).design_summary
    end

    # Review-and-refine stage of the agent loop: the model critiques the just-built design and
    # iterates with the editing tools until satisfied (the tool loop's MAX_TOOL_ROUNDS bounds it).
    REVIEW_SYSTEM_PROMPT = <<~PROMPT
      You are the review-and-refine stage of a design agent working inside Inkwell's visual
      Page Builder. A design has been built on the canvas. Critique it against the user's request
      and strong design principles, then use the editing tools to fix weaknesses and polish it.
      Iterate — inspect, critique, refine — until you're genuinely satisfied, then reply with a
      short one-line confirmation of what you improved.

      Critique checklist:
      - Does it fully satisfy the user's request? Every requested section/element present?
      - Copy: specific, complete, on-topic (never lorem ipsum), not truncated.
      - Hierarchy: one clear hero, consistent headings, scannable sections.
      - Spacing & rhythm: balanced sections, comfortable padding, not cramped or sparse.
      - Color & contrast: dark sections keep light text, light sections dark text; accents used
        intentionally (tokens via set_custom_css / css_edit).
      - Polish: no awkward gaps, empty sections, or duplicate headlines.

      Use read_design / read_section / read_css to inspect, and edit_element / edit_section /
      add_section / remove_section / move_section / css_edit / set_custom_css to refine. Do NOT
      output a design format — the design is already on the canvas; refine it with tools only.
    PROMPT

    def review_messages(design)
      parts = [ "The user asked: #{params[:prompt].to_s.strip}" ]
      parts << "Page title: #{params[:context]}" if params[:context].to_s.present?
      parts << "Site name: #{params[:site]}" if params[:site].to_s.present?
      parts << "Design language: #{params[:brand]}" if params[:brand].to_s.present?
      parts << "Current design (0-indexed):\n#{design.design_summary}"
      parts << "Review it critically and refine it with the editing tools until you're satisfied, then confirm in one line what you improved."
      [ { role: "user", content: parts.join("\n\n") } ]
    end

    def stream_json(payload)
      response.stream.write("data: #{JSON.generate(payload)}\n\n")
    end

    def stream_done
      response.stream.write("data: [DONE]\n\n")
    end

    # Prior turns + the current turn (mode, current blocks, context, and the user's request).
    def build_messages
      history = Array(params[:history]).filter_map do |m|
        { role: m["role"], content: m["content"].to_s } if %w[user assistant].include?(m["role"])
      end
      history + [ { role: "user", content: build_prompt } ]
    end

    def build_prompt
      mode = %w[draft continue rewrite_page improve design add_section edit_section].include?(params[:mode]) ? params[:mode] : "draft"
      context = params[:context].to_s
      record_type = params[:recordType].to_s
      site_name = params[:site].to_s
      prompt = params[:prompt].to_s
      blocks = Array(params[:blocks])
      html = params[:html].to_s
      edit_section = params[:editSection]
      current_sections = Array(params[:currentSections])

      parts = []
      parts << "Page title: #{context}" if context.present?
      parts << "Site name: #{site_name}" if site_name.present?
      parts << "Editing a #{record_type}" if record_type.present?
      parts << "Mode: #{mode}"
      if params[:env] == "html"
        parts << "Current page HTML: #{html}"
        parts << "Current builder store: #{params[:store].to_json}"
      else
        parts << "Current document (JSON): #{blocks.to_json}"
      end
      if current_sections.present?
        parts << "Current design (grep-style index — use these numbers to target edits):\n#{design_index(current_sections)}"
      end
      mode_steering = {
        "add_section" => "TASK: ADD new section(s) to the CURRENT design. Do NOT replace, remove, or redesign existing sections. Prefer ADD SECTION [AFTER <n>] ops; if you use the full design format, output ONLY the new section(s).",
        "rewrite" => "TASK: REWRITE the entire page as a fresh design.",
        "design" => "TASK: design as requested. If the user asks to change or extend part of the current design, use PRECISION EDITS (ops) rather than a full redesign."
      }
      parts << mode_steering[mode] if mode_steering[mode]
      if edit_section.present?
        parts << "SURGICAL EDIT: change ONLY section #{Integer(edit_section) + 1} of the design."
        parts << "Reply with the design text format for JUST that one section (REPLY + BG + elements) — do not output the other sections."
      end
      brand = params[:brand].to_s.strip
      parts << design_language_block(brand) if brand.present? && mcp_enabled?
      parts << "User request: #{prompt}"
      parts.join("\n\n")
    end
  end
end
