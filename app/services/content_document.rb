# Plain-text and structural facts from the same structured content the site renders.
class ContentDocument
  attr_reader :paragraphs, :headings, :links, :images

  def initialize(blocks)
    @paragraphs, @headings, @links, @images = [], 0, 0, []
    Array(blocks).each { |block| read_block(block.deep_stringify_keys) if block.is_a?(Hash) }
  end

  def text = paragraphs.join(" ").squish
  def words = text.scan(/[[:alnum:]]+(?:['’-][[:alnum:]]+)*/)

  private

  def add_text(value)
    fragment = Nokogiri::HTML.fragment(value.to_s)
    fragment.css("script, style, template").remove
    fragment.css("p, div, h1, h2, h3, h4, h5, h6, li, br").each { |node| node.add_next_sibling(Nokogiri::XML::Text.new(" ", fragment.document)) }
    @paragraphs << fragment.text.squish if fragment.text.squish.present?
  end

  def read_block(block)
    data = block["data"].is_a?(Hash) ? block["data"] : {}
    case block["type"]
    when "rich_text"
      doc = data["json"].is_a?(String) ? JSON.parse(data["json"]) : data["json"]
      read_node(doc) if doc.is_a?(Hash)
    when "page_builder"
      html = Nokogiri::HTML.fragment(data["html"].to_s)
      html.css("script,style,template").remove
      @headings += html.css("h1,h2,h3,h4,h5,h6").size
      @links += html.css("a[href]").size
      @images.concat(html.css("img[src]").map { |image| { "url" => image["src"], "alt" => image["alt"] } })
      add_text(html.to_html)
    else
      @headings += 1 if block["type"] == "heading"
      @headings += 1 if block["type"] == "faq"
      @links += 1 if %w[button cta].include?(block["type"]) && (data["url"].presence || data["primary_url"]).present?
      @images << data if block["type"] == "image" && data["url"].present?
      structured_strings(data).each do |value|
        @links += value.scan(InlineText::LINK).size
        add_text(InlineText.plain(value))
      end
    end
  rescue JSON::ParserError
    # Invalid rich text cannot be rendered and should not contribute JSON source as prose.
  end

  # Every human-readable string in a structured block (table cells, FAQ answers, stats…),
  # skipping technical values such as URLs, tones and sizes.
  TECHNICAL_KEYS = %w[url link primary_url secondary_url tone style size level language anchor ordered row_headers highlight width height alt credit].freeze

  def structured_strings(value, key = nil)
    case value
    when Hash then value.flat_map { |k, v| TECHNICAL_KEYS.include?(k.to_s) ? [] : structured_strings(v, k) }
    when Array then value.flat_map { |v| structured_strings(v, key) }
    when String then value.strip.empty? ? [] : [ value ]
    else []
    end
  end

  def read_node(node)
    return unless node.is_a?(Hash)
    @headings += 1 if node["type"] == "heading"
    @links += Array(node["marks"]).count { |mark| mark.is_a?(Hash) && mark["type"] == "link" }
    @images << { "url" => node.dig("attrs", "src"), "alt" => node.dig("attrs", "alt") } if node["type"] == "image"
    if %w[paragraph heading codeBlock].include?(node["type"])
      @paragraphs << node_text(node).squish if node_text(node).squish.present?
      Array(node["content"]).each { |child| count_inline(child) }
    else
      Array(node["content"]).each { |child| read_node(child) }
    end
  end

  def count_inline(node)
    return unless node.is_a?(Hash)
    @images << { "url" => node.dig("attrs", "src"), "alt" => node.dig("attrs", "alt") } if node["type"] == "image"
    @links += Array(node["marks"]).count { |mark| mark.is_a?(Hash) && mark["type"] == "link" }
    Array(node["content"]).each { |child| count_inline(child) }
  end

  def node_text(node)
    return "" unless node.is_a?(Hash)
    return node["text"].to_s if node["type"] == "text"
    return " " if node["type"] == "hardBreak"
    Array(node["content"]).map { |child| node_text(child) }.join
  end
end
