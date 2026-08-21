module AiWriter
  # Copilot's chat endpoint. Streams an SSE response from the provider so the widget can show
  # thinking as it happens, then the client parses the model's { reply, actions } JSON and
  # executes any edit operations against the block editor. The API key never leaves the server.
  class CompletionsController < Admin::BaseController
    include ActionController::Live

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
      client.stream_chat(build_messages, system: system_prompt) do |delta|
        stream_json(choice: { delta: { content: delta } })
      end
      stream_done
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
      - Keep it concise.
    PROMPT

    private

    def system_prompt
      params[:env] == "html" ? PAGE_BUILDER_SYSTEM_PROMPT : COPILOT_SYSTEM_PROMPT
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
      if edit_section.present?
        parts << "SURGICAL EDIT: change ONLY section #{Integer(edit_section) + 1} of the design."
        parts << "Current design sections: #{current_sections.to_json}"
        parts << "Reply with the design text format for JUST that one section (REPLY + BG + elements) — do not output the other sections."
      end
      parts << "User request: #{prompt}"
      parts.join("\n\n")
    end
  end
end
