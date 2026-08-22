# Parses the Copilot's marked-text design format (REPLY:/BG:/H5:/H1:/P:/BUTTON:/LIST:/CSS:/JS:)
# into the compact design spec `{ "elementLists" => [{ "bg" =>, "elements" => [...] }] }`.
# Server-side mirror of the widget's parseDesignText, so the server owns the design state and
# can feed it back to the model for the review-and-refine (agentic) loop.
module AiWriter
  class DesignSpec
    ELEMENT_TYPES = {
      "H5" => "H5Element", "H1" => "H1Element", "P" => "PElement",
      "BUTTON" => "ButtonElement", "LIST" => "ListElement", "IMG" => "ImageElement",
      "DIVIDER" => "DividerElement"
    }.freeze

    # Returns { reply:, elementLists:, customCss:, customJs: } or nil if nothing parseable.
    def self.parse(text)
      new(text).call
    end

    def initialize(text)
      @text = text.to_s
    end

    def call
      reply = ""
      custom_css = +""
      custom_js = +""
      sections = []
      current = nil
      mode = "design"

      @text.split("\n").each do |raw|
        line = raw.strip
        next if line.empty? && mode == "design"

        if line =~ /\AREPLY:/i
          reply = Regexp.last_match.post_match.strip
        elsif line =~ /\ACSS:/i
          mode = "css"
        elsif line =~ /\AJS:/i
          mode = "js"
        elsif line =~ /\ABG:\s*(.*)/i
          mode = "design"
          current = { "bg" => Regexp.last_match(1).strip.presence, "elements" => [] }
          sections << current
        elsif mode == "css"
          custom_css << raw << "\n"
        elsif mode == "js"
          custom_js << raw << "\n"
        elsif (m = line.match(/\A(H5|H1|P|BUTTON|LIST|IMG|DIVIDER):\s*(.*)\z/i))
          type = m[1].upcase
          content = m[2].strip
          current ||= { "bg" => nil, "elements" => [] }
          current["elements"] << element(type, content) if element(type, content)
          sections << current unless sections.include?(current)
        elsif (m = line.match(/\AAURORA:\s*(.*)\z/i))
          current ||= { "bg" => nil, "elements" => [] }
          current["aurora"] = true
          parts = m[1].split("|").map(&:strip)
          current["bg"] = parts[0].presence if parts[0].present?
          if parts.length >= 2
            current["auroraFrom"] = parts[1]
            current["auroraTo"] = parts[2].presence || parts[1]
          end
          sections << current unless sections.include?(current)
        elsif (m = line.match(/\AGRADIENT:\s*(.*)\z/i))
          current ||= { "bg" => nil, "elements" => [] }
          parts = m[1].split("|").map(&:strip)
          el = { "name" => "GradientTitleElement", "template" => "GradientTitle", "text" => parts.length > 1 ? parts[-1] : parts[0] }
          el["from"] = parts[0]
          el["to"] = parts[1].presence || parts[0] if parts.length >= 2
          current["elements"] << el
          sections << current unless sections.include?(current)
        elsif (m = line.match(/\ASHIMMER:\s*(.*)\z/i))
          current ||= { "bg" => nil, "elements" => [] }
          current["elements"] << { "name" => "ShimmerTitleElement", "template" => "ShimmerTitle", "text" => m[1].strip }
          sections << current unless sections.include?(current)
        elsif (m = line.match(/\AMARQUEE:\s*(.*)\z/i))
          current ||= { "bg" => nil, "elements" => [] }
          current["elements"] << { "name" => "MarqueeElement", "template" => "Marquee", "text" => m[1].strip }
          sections << current unless sections.include?(current)
        elsif (m = line.match(/\ACARD:\s*(.*)\z/i))
          current ||= { "bg" => nil, "elements" => [] }
          current["bento"] = true
          parts = m[1].split("|").map(&:strip)
          span = parts[2].to_s.downcase == "wide" ? "wide" : parts[2].to_s.downcase == "tall" ? "tall" : ""
          current["elements"] << { "name" => "BentoCardElement", "template" => "BentoCard", "text" => parts[0..1].join("|"), "span" => span }
          sections << current unless sections.include?(current)
        elsif (m = line.match(/\ASPOTCARD:\s*(.*)\z/i))
          current ||= { "bg" => nil, "elements" => [] }
          current["elements"] << { "name" => "SpotlightCardElement", "template" => "SpotlightCard", "text" => m[1].strip }
          sections << current unless sections.include?(current)
        elsif (m = line.match(/\ASTAT:\s*(.*)\z/i))
          current ||= { "bg" => nil, "elements" => [] }
          current["elements"] << { "name" => "StatElement", "template" => "Stat", "text" => m[1].strip }
          sections << current unless sections.include?(current)
        elsif /^SPOTLIGHT|^BENTO|^NOISE/i.match?(line)
          current ||= { "bg" => nil, "elements" => [] }
          current["spotlight"] = true if /^SPOTLIGHT/i.match?(line)
          current["bento"] = true if /^BENTO/i.match?(line)
          current["noise"] = true if /^NOISE/i.match?(line)
          sections << current unless sections.include?(current)
        elsif (m = line.match(/\AEFFECT:\s*(.*)\z/i))
          current ||= { "bg" => nil, "elements" => [] }
          current["effect"] = m[1].strip.downcase
          sections << current unless sections.include?(current)
        end
      end

      return nil if sections.empty?

      { "reply" => reply, "elementLists" => sections, "customCss" => custom_css.strip, "customJs" => custom_js.strip }
    end

    private

    def element(type, content)
      name = ELEMENT_TYPES[type]
      return nil unless name

      el = { "name" => name, "template" => name.sub(/Element\z/, ""), "text" => content }
      el["align"] = "left" if %w[P LIST].include?(type)
      el["text"] = content.split("|").map(&:strip).join("\n") if type == "LIST"
      el["text"] = "" if type == "DIVIDER"
      el
    end
  end
end
