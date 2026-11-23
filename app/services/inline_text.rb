# A deliberately tiny, safe inline formatter for short structured text (table cells, FAQ
# answers, takeaways, callouts, stats). It escapes everything first, then recognises a
# fixed vocabulary — **bold**, *italic*, `code`, ~~strike~~ and [label](url) — so authors
# and agents get inline emphasis and links without any stored HTML ever being executed.
module InlineText
  module_function

  LINK = /\[([^\]\n]{1,300})\]\(([^)\s]{1,2000})\)/
  CODE = /`([^`\n]{1,300})`/
  BOLD = /\*\*([^*\n]{1,500})\*\*/
  ITALIC = /(?<![*\w])\*([^*\n]{1,500})\*(?![*\w])/
  STRIKE = /~~([^~\n]{1,500})~~/
  ESCAPE = /\\([*_`\[\]~\\])/

  def render(value, external_links: true)
    text = value.to_s
    return "" if text.empty?

    # Pull code spans and links out first so their contents are not re-formatted.
    tokens = []
    stash = ->(html) { tokens << html; "\u0000#{tokens.size - 1}\u0000" }

    # Markdown-style escapes (\*, \_, \`, \[, \], \~) render the literal character.
    text = text.gsub(ESCAPE) { stash.call(ERB::Util.html_escape(Regexp.last_match(1))) }
    text = text.gsub(CODE) { stash.call("<code>#{ERB::Util.html_escape(Regexp.last_match(1))}</code>") }
    text = text.gsub(LINK) do
      label, href = Regexp.last_match(1), safe_url(Regexp.last_match(2))
      next ERB::Util.html_escape(label) unless href
      rel = external_links && href.match?(%r{\Ahttps?://}i) ? %( rel="noopener") : ""
      stash.call(%(<a href="#{ERB::Util.html_escape(href)}"#{rel}>#{format_marks(ERB::Util.html_escape(label))}</a>))
    end

    html = format_marks(ERB::Util.html_escape(text))
    html = html.gsub(/\r?\n/, "<br>")
    html.gsub(/\u0000(\d+)\u0000/) { tokens[Regexp.last_match(1).to_i] }
  end

  # Plain text with the inline markers removed (for JSON-LD, excerpts and search).
  def plain(value)
    value.to_s.gsub(ESCAPE, '\1').gsub(LINK, '\1').gsub(CODE, '\1').gsub(BOLD, '\1').gsub(STRIKE, '\1').gsub(ITALIC, '\1').squish
  end

  def format_marks(escaped)
    escaped.gsub(BOLD, '<strong>\1</strong>').gsub(STRIKE, '<s>\1</s>').gsub(ITALIC, '<em>\1</em>')
  end

  def safe_url(value)
    value = value.to_s.strip
    return if value.empty?
    return value if value.start_with?("/", "#") && !value.start_with?("//")
    return value if value.match?(%r{\Ahttps?://}i)
    value if value.match?(%r{\Amailto:}i)
  end
end
