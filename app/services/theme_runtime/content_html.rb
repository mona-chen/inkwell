module ThemeRuntime
  # Renders stored block content into the HTML string exposed by the theme data
  # contract. It never evaluates stored strings as markup; text is escaped and
  # only Builder-owned page HTML (already produced by the real renderer) is kept.
  #
  # Every block emits semantic HTML with stable `ink-*` hook classes so any theme
  # can style the full vocabulary (tables, FAQs, takeaways, stats, CTAs, embeds…).
  # Headings receive unique anchors, collected into `toc`; FAQ blocks are collected
  # into `faq` for FAQPage structured data.
  class ContentHtml
    TONES = %w[info tip success warning danger].freeze
    TONE_LABELS = { "info" => "Note", "tip" => "Tip", "success" => "Good to know", "warning" => "Warning", "danger" => "Important" }.freeze
    YES = [ "✓", "✔", "✅", "yes", "true" ].freeze
    NO = [ "✗", "✕", "✘", "❌", "no", "false" ].freeze
    PARTIAL = [ "~", "partial", "partly", "limited" ].freeze

    attr_reader :toc, :faq

    def self.render(blocks)
      new(blocks).render
    end

    # Full analysis in a single pass: html, table of contents and FAQ entries.
    def self.analyze(blocks)
      renderer = new(blocks)
      html = renderer.render
      { "html" => html, "toc" => renderer.toc, "faq" => renderer.faq }
    end

    # Allow-listed video providers → [provider, privacy-friendly iframe URL].
    def self.embed_source(url)
      uri = URI.parse(url.to_s)
      host = uri.host.to_s.downcase.sub(/\A(?:www|m)\./, "")
      params = URI.decode_www_form(uri.query.to_s).to_h
      case host
      when "youtube.com", "youtube-nocookie.com"
        id = params["v"] || uri.path[%r{\A/(?:embed|shorts|live)/([\w-]{6,20})}, 1]
        id&.match?(/\A[\w-]{6,20}\z/) ? [ "youtube", "https://www.youtube-nocookie.com/embed/#{id}" ] : nil
      when "youtu.be"
        id = uri.path[%r{\A/([\w-]{6,20})}, 1]
        id ? [ "youtube", "https://www.youtube-nocookie.com/embed/#{id}" ] : nil
      when "vimeo.com", "player.vimeo.com"
        id = uri.path[/(\d{5,12})/, 1]
        id ? [ "vimeo", "https://player.vimeo.com/video/#{id}?dnt=1" ] : nil
      when "loom.com"
        id = uri.path[%r{\A/(?:share|embed)/([0-9a-f]{16,40})}, 1]
        id ? [ "loom", "https://www.loom.com/embed/#{id}" ] : nil
      end
    rescue URI::InvalidURIError, ArgumentError
      nil
    end

    def initialize(blocks)
      @blocks = Array(blocks)
      @toc = []
      @faq = []
      @anchors = Hash.new(0)
    end

    def render
      @rendered ||= @blocks.filter_map { |block| render_block(block.deep_stringify_keys) if block.is_a?(Hash) }.join
    end

    private

    def render_block(block)
      data = block["data"].is_a?(Hash) ? block["data"] : {}
      case block["type"]
      when "heading" then heading(data.fetch("level", 2), data["text"], anchor: data["anchor"])
      when "paragraph"
        body = inline(data["text"])
        body.present? ? "<p>#{body}</p>" : nil
      when "quote" then render_quote(data)
      when "code" then render_code(data)
      when "separator" then %(<hr class="ink-separator">)
      when "callout" then render_callout(data)
      when "image" then render_image(data)
      when "button" then render_button(data)
      when "list" then render_list(data)
      when "table" then render_table(data)
      when "takeaways" then render_takeaways(data)
      when "stats" then render_stats(data)
      when "pros_cons" then render_pros_cons(data)
      when "faq" then render_faq(data)
      when "cta" then render_cta(data)
      when "embed" then render_embed(data)
      when "rich_text" then render_rich_text(data["json"])
      when "page_builder" then data["html"].to_s
      end
    end

    # --- blocks -------------------------------------------------------------

    def heading(level, value, anchor: nil, inner_html: nil)
      level = level.to_i.clamp(1, 6)
      plain = value.to_s.squish
      return nil if plain.empty?

      id = unique_anchor(anchor.presence || plain)
      @toc << { "id" => id, "text" => plain, "level" => level } if level.between?(2, 3)
      %(<h#{level} id="#{id}">#{inner_html || text(plain)}</h#{level}>)
    end

    def render_quote(data)
      body = inline(data["text"])
      return nil if body.blank?

      who = [ data["attribution"].presence || data["citation"].presence, data["role"].presence ].compact
      cite = who.any? ? %(<figcaption><cite>#{text(who.first)}</cite>#{who[1] ? %(<span>#{text(who[1])}</span>) : ''}</figcaption>) : ""
      style = data["style"] == "pull" ? " ink-quote--pull" : ""
      %(<figure class="ink-quote#{style}"><blockquote><p>#{body}</p></blockquote>#{cite}</figure>)
    end

    def render_code(data)
      code = data["code"].presence || data["text"]
      return nil if code.blank?

      language = data["language"].to_s.downcase.gsub(/[^a-z0-9+#-]/, "").first(40)
      label = data["filename"].presence || language.presence
      head = label ? %(<figcaption class="ink-code__label">#{text(label)}</figcaption>) : ""
      klass = language.present? ? %( class="language-#{language}") : ""
      attr = language.present? ? %( data-language="#{language}") : ""
      %(<figure class="ink-code"#{attr}>#{head}<pre><code#{klass}>#{text(code)}</code></pre></figure>)
    end

    def render_callout(data)
      body = inline(data["text"])
      return nil if body.blank?

      tone = TONES.include?(data["tone"]) ? data["tone"] : "info"
      title = data["title"].presence || TONE_LABELS[tone]
      %(<aside class="ink-callout ink-callout--#{tone}" role="note"><p class="ink-callout__title">#{text(title)}</p><div class="ink-callout__body"><p>#{body}</p></div></aside>)
    end

    def render_image(data)
      url = safe_url(data["url"])
      return unless url

      size = %w[wide full].include?(data["size"]) ? " ink-figure--#{data['size']}" : ""
      dims = %w[width height].filter_map { |key| %( #{key}="#{data[key].to_i}") if data[key].to_i.positive? }.join
      image = %(<img src="#{h(url)}" alt="#{h(data['alt'])}" loading="lazy" decoding="async"#{dims}>)
      link = safe_url(data["link"])
      image = %(<a href="#{h(link)}">#{image}</a>) if link
      parts = []
      parts << %(<span class="ink-figure__caption">#{inline(data['caption'])}</span>) if data["caption"].present?
      parts << %(<span class="ink-figure__credit">#{text(data['credit'])}</span>) if data["credit"].present?
      caption = parts.any? ? "<figcaption>#{parts.join(' ')}</figcaption>" : ""
      %(<figure class="ink-figure#{size}">#{image}#{caption}</figure>)
    end

    def render_button(data)
      url = safe_url(data["url"])
      return unless url

      style = %w[secondary outline].include?(data["style"]) ? data["style"] : "primary"
      %(<p class="ink-button-row"><a class="ink-button ink-button--#{style}" href="#{h(url)}">#{text(data['label'].presence || data['text'].presence || url)}</a></p>)
    end

    def render_list(data)
      items = list_items(data["items"])
      return nil if items.empty?

      style = data["style"].presence || (truthy?(data["ordered"]) ? "number" : "bullet")
      tag = style == "number" ? "ol" : "ul"
      klass = style == "check" ? "ink-list ink-list--check" : "ink-list"
      %(<#{tag} class="#{klass}">#{items.map { |item| "<li>#{inline(item)}</li>" }.join}</#{tag}>)
    end

    def render_table(data)
      columns = Array(data["columns"]).map(&:to_s)
      rows = Array(data["rows"]).select { |row| row.is_a?(Array) }
      return nil if columns.empty? && rows.empty?

      width = [ columns.size, rows.map(&:size).max.to_i ].max
      highlight = data["highlight"].to_s.match?(/\A\d+\z/) ? data["highlight"].to_i : nil
      row_headers = data.key?("row_headers") ? truthy?(data["row_headers"]) : true
      cell_class = ->(index) { index == highlight ? %( class="is-highlighted") : "" }

      head = ""
      if columns.any?
        cells = (0...width).map { |i| %(<th scope="col"#{cell_class.call(i)}>#{inline(columns[i])}</th>) }.join
        head = "<thead><tr>#{cells}</tr></thead>"
      end
      body = rows.map do |row|
        cells = (0...width).map do |i|
          if i.zero? && row_headers
            %(<th scope="row"#{cell_class.call(i)}>#{table_cell(row[i])}</th>)
          else
            label = columns[i].present? ? %( data-label="#{h(InlineText.plain(columns[i]))}") : ""
            %(<td#{cell_class.call(i)}#{label}>#{table_cell(row[i])}</td>)
          end
        end.join
        "<tr>#{cells}</tr>"
      end.join
      caption = data["caption"].present? ? "<caption>#{text(data['caption'])}</caption>" : ""
      label = data["caption"].present? ? %( aria-label="#{h(data['caption'])}") : %( aria-label="Table")
      note = data["note"].present? ? %(<figcaption class="ink-table__note">#{inline(data['note'])}</figcaption>) : ""
      highlighted = highlight ? %( data-highlight="#{highlight}") : ""
      %(<figure class="ink-table"#{highlighted} data-columns="#{width}"><div class="ink-table__scroll" role="region" tabindex="0"#{label}><table>#{caption}#{head}<tbody>#{body}</tbody></table></div>#{note}</figure>)
    end

    def table_cell(value)
      key = value.to_s.strip.downcase
      return %(<span class="ink-mark ink-mark--yes" role="img" aria-label="Yes"></span>) if YES.include?(key)
      return %(<span class="ink-mark ink-mark--no" role="img" aria-label="No"></span>) if NO.include?(key)
      return %(<span class="ink-mark ink-mark--partial" role="img" aria-label="Partial"></span>) if PARTIAL.include?(key)

      inline(value)
    end

    def render_takeaways(data)
      items = list_items(data["items"])
      return nil if items.empty?

      title = data["title"].presence || "Key takeaways"
      %(<aside class="ink-takeaways" aria-label="#{h(title)}"><p class="ink-takeaways__title">#{text(title)}</p><ul>#{items.map { |item| "<li>#{inline(item)}</li>" }.join}</ul></aside>)
    end

    def render_stats(data)
      items = Array(data["items"]).select { |item| item.is_a?(Hash) && item["value"].present? }.first(4)
      return nil if items.empty?

      cells = items.map do |item|
        note = item["note"].present? ? %(<p class="ink-stat__note">#{text(item['note'])}</p>) : ""
        %(<div class="ink-stat"><p class="ink-stat__value">#{text(item['value'])}</p><p class="ink-stat__label">#{text(item['label'])}</p>#{note}</div>)
      end.join
      source = data["source"].present? ? %(<figcaption class="ink-stats__source">#{inline(data['source'])}</figcaption>) : ""
      %(<figure class="ink-stats" data-count="#{items.size}"><div class="ink-stats__grid">#{cells}</div>#{source}</figure>)
    end

    def render_pros_cons(data)
      pros = list_items(data["pros"])
      cons = list_items(data["cons"])
      return nil if pros.empty? && cons.empty?

      column = lambda do |kind, title, items|
        %(<section class="ink-proscons__col ink-proscons__col--#{kind}"><p class="ink-proscons__title">#{text(title)}</p><ul>#{items.map { |item| "<li>#{inline(item)}</li>" }.join}</ul></section>)
      end
      %(<div class="ink-proscons">#{column.call('pros', data['pros_title'].presence || 'Pros', pros)}#{column.call('cons', data['cons_title'].presence || 'Cons', cons)}</div>)
    end

    def render_faq(data)
      items = Array(data["items"]).select { |item| item.is_a?(Hash) && item["question"].present? && item["answer"].present? }
      return nil if items.empty?

      title = data["title"].presence || "Frequently asked questions"
      entries = items.map do |item|
        @faq << { "question" => item["question"].to_s.squish, "answer" => InlineText.plain(item["answer"]) }
        %(<details class="ink-faq__item"><summary>#{text(item['question'])}</summary><div class="ink-faq__answer"><p>#{inline(item['answer'])}</p></div></details>)
      end.join
      %(<section class="ink-faq">#{heading(2, title)}#{entries}</section>)
    end

    def render_cta(data)
      primary = safe_url(data["primary_url"])
      return nil if data["title"].blank? || primary.nil?

      secondary = safe_url(data["secondary_url"])
      actions = %(<a class="ink-button ink-button--primary" href="#{h(primary)}">#{text(data['primary_label'].presence || 'Learn more')}</a>)
      actions += %(<a class="ink-button ink-button--secondary" href="#{h(secondary)}">#{text(data['secondary_label'].presence || 'Learn more')}</a>) if secondary
      eyebrow = data["eyebrow"].present? ? %(<p class="ink-cta__eyebrow">#{text(data['eyebrow'])}</p>) : ""
      body = data["text"].present? ? %(<p class="ink-cta__text">#{inline(data['text'])}</p>) : ""
      %(<aside class="ink-cta">#{eyebrow}<p class="ink-cta__title">#{text(data['title'])}</p>#{body}<p class="ink-cta__actions">#{actions}</p></aside>)
    end

    def render_embed(data)
      url = safe_url(data["url"])
      return nil unless url

      title = data["title"].presence || "Embedded video"
      caption = data["caption"].present? ? %(<figcaption>#{inline(data['caption'])}</figcaption>) : ""
      provider, src = self.class.embed_source(url)
      if src
        %(<figure class="ink-embed ink-embed--#{provider}"><div class="ink-embed__frame"><iframe src="#{h(src)}" title="#{h(title)}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>#{caption}</figure>)
      else
        host = (URI.parse(url).host.to_s.sub(/\Awww\./, "") rescue "")
        %(<figure class="ink-embed ink-embed--link"><a class="ink-embed__link" href="#{h(url)}" rel="noopener"><span>#{text(title)}</span><small>#{text(host)}</small></a>#{caption}</figure>)
      end
    end

    # --- rich text ---------------------------------------------------------

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
        value = text(node["text"])
        Array(node["marks"]).each do |mark|
          next unless mark.is_a?(Hash)
          value = case mark["type"]
          when "bold" then "<strong>#{value}</strong>"
          when "italic" then "<em>#{value}</em>"
          when "underline" then "<u>#{value}</u>"
          when "code" then "<code>#{value}</code>"
          when "strike" then "<s>#{value}</s>"
          when "link"
            href = safe_url(mark.dig("attrs", "href"))
            rel = href.to_s.match?(%r{\Ahttps?://}i) ? %( rel="noopener") : ""
            href ? %(<a href="#{h(href)}"#{rel}>#{value}</a>) : value
          else value
          end
        end
        value
      when "doc" then children
      when "paragraph" then children.present? ? "<p>#{children}</p>" : ""
      when "heading" then heading(node.dig("attrs", "level") || 2, node_text(node), anchor: node.dig("attrs", "id"), inner_html: children).to_s
      when "bulletList" then %(<ul class="ink-list">#{children}</ul>)
      when "orderedList" then %(<ol class="ink-list">#{children}</ol>)
      when "taskList" then %(<ul class="ink-list ink-list--check">#{children}</ul>)
      when "listItem", "taskItem" then "<li>#{children}</li>"
      when "blockquote" then %(<blockquote class="ink-blockquote">#{children}</blockquote>)
      when "codeBlock"
        language = node.dig("attrs", "language").to_s.downcase.gsub(/[^a-z0-9+#-]/, "")
        klass = language.present? ? %( class="language-#{language}") : ""
        %(<figure class="ink-code"><pre><code#{klass}>#{children}</code></pre></figure>)
      when "hardBreak" then "<br>"
      when "horizontalRule" then %(<hr class="ink-separator">)
      when "image"
        url = safe_url(node.dig("attrs", "src"))
        title = node.dig("attrs", "title").present? ? "<figcaption>#{text(node.dig('attrs', 'title'))}</figcaption>" : ""
        url ? %(<figure class="ink-figure"><img src="#{h(url)}" alt="#{h(node.dig('attrs', 'alt'))}" loading="lazy" decoding="async">#{title}</figure>) : ""
      when "table" then %(<figure class="ink-table"><div class="ink-table__scroll" role="region" tabindex="0" aria-label="Table"><table><tbody>#{children}</tbody></table></div></figure>)
      when "tableRow" then "<tr>#{children}</tr>"
      when "tableHeader" then %(<th scope="col">#{unwrap_paragraph(children)}</th>)
      when "tableCell" then "<td>#{unwrap_paragraph(children)}</td>"
      else children
      end
    end

    def unwrap_paragraph(html)
      html.sub(%r{\A<p>(.*)</p>\z}m, '\1')
    end

    def node_text(node)
      return "" unless node.is_a?(Hash)
      return node["text"].to_s if node["type"] == "text"
      return " " if node["type"] == "hardBreak"
      Array(node["content"]).map { |child| node_text(child) }.join
    end

    # --- helpers -----------------------------------------------------------

    def unique_anchor(value)
      base = value.to_s.parameterize.first(80).sub(/-+\z/, "").presence || "section"
      @anchors[base] += 1
      @anchors[base] == 1 ? base : "#{base}-#{@anchors[base]}"
    end

    def list_items(value)
      items = value.is_a?(Array) ? value : value.to_s.split(/\r?\n/)
      items.map { |item| item.to_s.sub(/\A\s*(?:[-*•]|\d+[.)])\s+/, "").strip }.reject(&:empty?)
    end

    def truthy?(value)
      value == true || %w[true 1].include?(value.to_s)
    end

    def inline(value)
      InlineText.render(value)
    end

    def safe_url(value)
      InlineText.safe_url(value)
    end

    def text(value)
      ERB::Util.html_escape(value.to_s)
    end
    alias h text
  end
end
