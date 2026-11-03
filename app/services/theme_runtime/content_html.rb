module ThemeRuntime
  # Renders stored block content into the HTML string exposed by the theme data
  # contract. It never evaluates stored strings as markup; text is escaped and
  # only Builder-owned page HTML (already produced by the real renderer) is kept.
  class ContentHtml
    def self.render(blocks)
      new(blocks).render
    end

    def initialize(blocks)
      @blocks = Array(blocks)
    end

    def render
      @blocks.filter_map { |block| render_block(block.deep_stringify_keys) if block.is_a?(Hash) }.join
    end

    private

    def render_block(block)
      data = block["data"].is_a?(Hash) ? block["data"] : {}
      case block["type"]
      when "heading"
        level = data.fetch("level", 2).to_i.clamp(1, 6)
        "<h#{level}>#{text(data['text'])}</h#{level}>"
      when "paragraph" then "<p>#{text(data['text'])}</p>"
      when "quote" then "<blockquote><p>#{text(data['text'])}</p>#{data['citation'].present? ? "<cite>#{text(data['citation'])}</cite>" : ''}</blockquote>"
      when "code" then "<pre><code>#{text(data['code'].presence || data['text'])}</code></pre>"
      when "separator" then "<hr>"
      when "callout" then "<aside>#{text(data['text'])}</aside>"
      when "image" then render_image(data)
      when "button"
        url = safe_url(data["url"])
        url ? "<p><a href=\"#{ERB::Util.html_escape(url)}\">#{text(data['label'].presence || data['text'])}</a></p>" : nil
      when "list"
        items = Array(data["items"]).map { |item| "<li>#{text(item)}</li>" }.join
        "<ul>#{items}</ul>"
      when "rich_text" then render_rich_text(data["json"])
      when "page_builder" then data["html"].to_s
      end
    end

    def render_image(data)
      url = safe_url(data["url"])
      return unless url

      caption = data["caption"].presence
      alt = data["alt"].to_s
      image = "<img src=\"#{ERB::Util.html_escape(url)}\" alt=\"#{ERB::Util.html_escape(alt)}\" loading=\"lazy\">"
      caption ? "<figure>#{image}<figcaption>#{text(caption)}</figcaption></figure>" : "<figure>#{image}</figure>"
    end

    def render_rich_text(raw)
      doc = raw.is_a?(String) ? JSON.parse(raw) : raw
      node_html(doc)
    rescue JSON::ParserError
      nil
    end

    def node_html(node)
      return "" unless node.is_a?(Hash)

      type = node["type"]
      children = Array(node["content"]).map { |child| node_html(child) }.join
      case type
      when "text"
        value = ERB::Util.html_escape(node["text"].to_s)
        Array(node["marks"]).each do |mark|
          value = case mark["type"]
          when "bold" then "<strong>#{value}</strong>"
          when "italic" then "<em>#{value}</em>"
          when "code" then "<code>#{value}</code>"
          when "strike" then "<s>#{value}</s>"
          when "link"
            href = safe_url(mark.dig("attrs", "href"))
            href ? "<a href=\"#{ERB::Util.html_escape(href)}\">#{value}</a>" : value
          else value
          end
        end
        value
      when "doc" then children
      when "paragraph" then "<p>#{children}</p>"
      when "heading"
        level = node.dig("attrs", "level").to_i.clamp(1, 6)
        "<h#{level}>#{children}</h#{level}>"
      when "bulletList" then "<ul>#{children}</ul>"
      when "orderedList" then "<ol>#{children}</ol>"
      when "listItem" then "<li>#{children}</li>"
      when "blockquote" then "<blockquote>#{children}</blockquote>"
      when "codeBlock" then "<pre><code>#{children}</code></pre>"
      when "hardBreak" then "<br>"
      when "horizontalRule" then "<hr>"
      when "image"
        url = safe_url(node.dig("attrs", "src"))
        url ? "<img src=\"#{ERB::Util.html_escape(url)}\" alt=\"#{ERB::Util.html_escape(node.dig('attrs', 'alt').to_s)}\" loading=\"lazy\">" : ""
      else children
      end
    end

    def safe_url(value)
      value = value.to_s.strip
      return if value.empty?
      return value if value.start_with?("/") && !value.start_with?("//")
      return value if value.match?(%r{\Ahttps?://}i)
      value if value.match?(%r{\Amailto:}i)
    end

    def text(value)
      ERB::Util.html_escape(value.to_s)
    end
  end
end
