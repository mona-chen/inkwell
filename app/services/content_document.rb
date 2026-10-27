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
      @links += 1 if block["type"] == "button" && data["url"].present?
      @images << data if block["type"] == "image" && data["url"].present?
      %w[text content caption items].each { |key| add_text(data[key].is_a?(Array) ? data[key].join(" ") : data[key]) if data[key].present? }
    end
  rescue JSON::ParserError
    # Invalid rich text cannot be rendered and should not contribute JSON source as prose.
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
