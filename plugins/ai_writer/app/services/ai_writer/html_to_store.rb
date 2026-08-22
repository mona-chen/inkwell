# Reconstructs an editable Ink Builder store from a saved Copilot design's HTML (the .cp-*
# markup that specToHtml produces). Legacy AI-generated pages saved only their HTML — no
# builder store — so without this the canvas would load blank. Parsing the semantic .cp-*
# sections back into a spec (then a store) lets the builder show and edit those designs.
module AiWriter
  class HtmlToStore
    def initialize(html)
      @html = html.to_s
    end

    # Returns a builder store (see PageBuilder::StoreBuilder), or nil if nothing parseable.
    def call
      sections = extract_sections.filter_map { |html| parse_section(html) }
      return nil if sections.empty?

      PageBuilder::StoreBuilder.new({ "elementLists" => sections }).call
    end

    private

    def extract_sections
      body = if (m = @html.match(%r{<body[^>]*>(.*?)</body>}m))
               m[1]
      else
               @html
      end
      body.scan(%r{<section([^>]*)>(.*?)</section>}m).map { |attrs, content| [ attrs, content ] }
    end

    def parse_section(pair)
      attrs, content = pair
      bg = attrs[%r{background:\s*([^";]+)}, 1]
      bg = nil if bg.to_s.start_with?("var(")

      elements = []
      text_in(/<p class="cp-eyebrow"[^>]*>(.*?)</, content) { |t| elements << element("H5Element", "H5", t) }
      text_in(/<h1 class="cp-title"[^>]*>(.*?)</, content) { |t| elements << element("H1Element", "H1", t) }
      text_in(/<p class="cp-lead"[^>]*>(.*?)</, content) { |t| elements << element("PElement", "P", t, "left") }
      content.scan(%r{<div class="cp-card">.*?<h3[^>]*>(.*?)</h3>\s*<p[^>]*>(.*?)</p>}m).each do |title, body|
        elements << element("H5Element", "H5", title)
        elements << element("PElement", "P", body, "left")
      end
      items = content.scan(%r{<li[^>]*>(.*?)</li>}m).flatten.map { |i| unescape(i) }
      elements << { "name" => "ListElement", "template" => "List", "text" => items.join("\n"), "align" => "left" } if items.any?
      content.scan(%r{<a[^>]*class="cp-btn[^"]*"[^>]*>(.*?)</a>}m).flatten.each do |text|
        elements << element("ButtonElement", "Button", text)
      end

      return nil if elements.empty?

      { "bg" => bg, "elements" => elements }
    end

    def element(name, template, text, align = nil)
      el = { "name" => name, "template" => template, "text" => unescape(text) }
      el["align"] = align if align
      el
    end

    def text_in(regex, html)
      html.scan(regex).flatten.each { |text| yield text }
    end

    def unescape(str)
      str.to_s.gsub("&amp;", "&").gsub("&lt;", "<").gsub("&gt;", ">").gsub("&quot;", '"')
    end
  end
end
