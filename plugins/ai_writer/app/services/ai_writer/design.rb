# Mutable working copy of the current page design — the compact spec the Copilot edits
# (`{ "elementLists" => [{ "bg" => ..., "elements" => [{ "name", "template", "text", "align" }] }] }`).
#
# The Copilot's editing tools (see EDITING_TOOL_SCHEMAS in CompletionsController) call
# #apply_tool, which mutates this copy server-side. After the model finishes, the controller
# streams the resulting spec back to the widget, which re-renders the canvas — so edits are
# deterministic tool calls, not fragile text parsing.
module AiWriter
  class Design
    ELEMENT_TYPES = {
      "H5" => { "name" => "H5Element", "template" => "H5" },
      "H1" => { "name" => "H1Element", "template" => "H1" },
      "P" => { "name" => "PElement", "template" => "P", "align" => "left" },
      "BUTTON" => { "name" => "ButtonElement", "template" => "Button" },
      "LIST" => { "name" => "ListElement", "template" => "List", "align" => "left" },
      "IMG" => { "name" => "ImageElement", "template" => "Image" },
      "DIVIDER" => { "name" => "DividerElement", "template" => "Divider", "text" => "" },
      # Magic design-kit elements (rendered by the builder's design system).
      "GRADIENT" => { "name" => "GradientTitleElement", "template" => "GradientTitle" },
      "SHIMMER" => { "name" => "ShimmerTitleElement", "template" => "ShimmerTitle" },
      "MARQUEE" => { "name" => "MarqueeElement", "template" => "Marquee" },
      "BENTOCARD" => { "name" => "BentoCardElement", "template" => "BentoCard" },
      "SPOTCARD" => { "name" => "SpotlightCardElement", "template" => "SpotlightCard" },
      "STAT" => { "name" => "StatElement", "template" => "Stat" }
    }.freeze

    attr_reader :sections, :custom_css, :custom_js

    def initialize(sections, custom_css: "", custom_js: "")
      @sections = Array(sections).map do |s|
        s = to_plain(s)
        sec = { "bg" => s["bg"], "elements" => Array(s["elements"]).map { |e| to_plain(e) } }
        # Preserve the design-kit section modifiers (aurora/bento/spotlight/effect/noise).
        %w[aurora bento spotlight noise effect auroraFrom auroraTo].each { |k| sec[k] = s[k] if s[k].present? }
        sec
      end
      @custom_css = custom_css.to_s
      @custom_js = custom_js.to_s
    end

    # Dispatch a tool call. `args` is the model's JSON-decoded arguments hash. Read tools return
    # their data; editing tools mutate and return a short status.
    def apply_tool(name, args)
      args = (args || {}).transform_keys(&:to_s)
      case name.to_s
      when "read_design" then design_summary
      when "read_section" then read_section(args)
      when "read_element" then read_element(args)
      when "read_css" then read_css(args)
      else
        apply_edit(name, args)
        "ok — design now has #{@sections.length} sections"
      end
    end

    def apply_edit(name, args)
      case name.to_s
      when "edit_element" then edit_element(args)
      when "edit_section" then edit_section(args)
      when "add_element" then add_element(args)
      when "remove_element" then remove_element(args)
      when "add_section" then add_section(args)
      when "remove_section" then remove_section(args)
      when "move_section" then move_section(args)
      when "set_custom_css" then @custom_css = args["css"].to_s
      when "set_custom_js" then @custom_js = args["js"].to_s
      when "css_edit" then css_edit(args)
      else "unknown tool: #{name}"
      end
    end

    # The final spec sent back to the widget, including any custom CSS/JS the model set.
    def to_spec
      { "elementLists" => @sections, "customCss" => @custom_css, "customJs" => @custom_js }
    end

    # ---- reading ("grep" on the design) ----------------------------------------------

    # A readable, line-numbered index of the whole design. Sections and elements are 0-indexed.
    def design_summary
      @sections.each_with_index.map do |sec, i|
        bg = sec["bg"]
        elements = sec["elements"].each_with_index.map do |el, j|
          name = el["name"].to_s.sub(/Element\z/, "").downcase
          text = el["text"].to_s
          suffix = el["align"] ? "  (align: #{el['align']})" : ""
          "    [#{j}] #{name}: #{text}#{suffix}"
        end.join("\n")
        "  [#{i}] section#{bg ? " bg=#{bg}" : ""}\n#{elements}"
      end.join("\n")
    end

    def read_section(args)
      index = args["section"].to_i
      sec = @sections[index]
      return "section #{index} not found" unless sec

      elements = sec["elements"].each_with_index.map do |el, j|
        name = el["name"].to_s.sub(/Element\z/, "").downcase
        "  [#{j}] #{name}: #{el['text']}#{el['align'] ? " (align #{el['align']})" : ''}"
      end.join("\n")
      "section #{index}: bg=#{sec['bg']}\n#{elements}"
    end

    def read_element(args)
      el = @sections[args["section"].to_i]&.dig("elements", args["element"].to_i)
      return "element not found" unless el

      el.map { |k, v| "#{k}: #{v.inspect}" }.join("\n")
    end

    def read_css(args)
      return "no custom css" if @custom_css.blank?

      selector = args["selector"].to_s.strip
      return @custom_css if selector.empty? || selector == "*"

      matches = @custom_css.scan(/#{Regexp.escape(selector)}\s*\{[^}]*\}/m)
      matches.any? ? matches.join("\n") : "no rule for selector: #{selector}"
    end

    private

    # Normalize request/JSON values to plain string-keyed hashes (ActionController::Parameters
    # would otherwise JSON-serialize as their inspect string).
    def to_plain(value)
      case value
      when ActionController::Parameters then value.to_unsafe_h
      when Hash then value.transform_keys(&:to_s)
      else {}
      end
    end

    def element_for(type, text, align)
      spec = ELEMENT_TYPES[type.to_s.upcase]
      return nil unless spec

      el = { "name" => spec["name"], "template" => spec["template"], "text" => align ? text.to_s : text.to_s }
      el["align"] = align if align.present?
      el["text"] = "" if spec.key?("text")
      el
    end

    def edit_element(args)
      sec = @sections[args["section"].to_i]
      el = sec && sec["elements"][args["element"].to_i]
      return "element not found" unless el

      case args["field"]
      when "text" then el["text"] = args["value"].to_s
      when "align" then el["align"] = args["value"].to_s
      else return "unknown field"
      end
      "updated"
    end

    def edit_section(args)
      sec = @sections[args["section"].to_i]
      return "section not found" unless sec

      case args["field"]
      when "bg" then sec["bg"] = args["value"].to_s.presence
      else return "unknown field"
      end
      "updated"
    end

    def add_element(args)
      sec = @sections[args["section"].to_i]
      return "section not found" unless sec

      el = element_for(args["type"], args["text"], args["align"])
      return "unknown element type" unless el

      sec["elements"] << el
      "added"
    end

    def remove_element(args)
      sec = @sections[args["section"].to_i]
      index = args["element"].to_i
      return "element not found" unless sec && sec["elements"][index]

      sec["elements"].delete_at(index)
      "removed"
    end

    def add_section(args)
      elements = Array(args["elements"]).filter_map do |e|
        e = e.transform_keys(&:to_s)
        element_for(e["type"], e["text"], e["align"])
      end
      new_section = { "bg" => args["bg"].to_s.presence, "elements" => elements }
      after = args["after"].to_i
      if args["after"].nil? || after < 0
        @sections << new_section
      else
        @sections.insert([ after + 1, @sections.length ].min, new_section)
      end
      "added"
    end

    def remove_section(args)
      index = args["section"].to_i
      return "section not found" unless @sections[index]

      @sections.delete_at(index)
      "removed"
    end

    def move_section(args)
      index = args["section"].to_i
      target = args["target"].to_i
      return "section not found" unless @sections[index]

      moved = @sections.delete_at(index)
      if target > index
        position = args["position"].to_s == "after" ? [ target, @sections.length ].min : target
      else
        position = args["position"].to_s == "after" ? target + 1 : target
      end
      @sections.insert([ position, @sections.length ].min, moved)
      "moved"
    end

    # Precision CSS editing ("sed" on the stylesheet): set ONE property on an existing selector
    # (e.g. ":root" → "--cp-accent", or ".cp-btn-primary" → "background"). If the selector
    # exists the declaration is updated (or added if missing); otherwise a new rule is appended.
    # Everything else in the stylesheet is untouched.
    def css_edit(args)
      selector = args["selector"].to_s.strip
      property = args["property"].to_s.strip
      value = args["value"].to_s.strip
      return "selector, property and value are required" if selector.empty? || property.empty? || value.empty?

      block_re = /(#{Regexp.escape(selector)}\s*\{)([^}]*)(\})/m
      if (match = block_re.match(@custom_css))
        decl_re = /(#{Regexp.escape(property)}\s*:\s*)[^;}]+/i
        inside = if match[2] =~ decl_re
                   match[2].sub(decl_re) { "#{Regexp.last_match(1)}#{value}" }
        else
                   "#{match[2].rstrip}\n  #{property}: #{value};"
        end
        @custom_css = @custom_css.sub(block_re) { "#{match[1]}#{inside}#{match[3]}" }
      else
        @custom_css = (@custom_css + "\n#{selector} {\n  #{property}: #{value};\n}").strip
      end
      "ok — #{selector} #{property} is now #{value}"
    end
  end
end
