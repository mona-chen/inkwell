module PageBuilder
  # Renders a builder-designed page. The stored block carries:
  #   html        — the canvas HTML converted to ERB (the body content)
  #   store       — the builder's element store (for re-editing in the canvas)
  #   custom_css  — page-level custom CSS, preserved across canvas saves
  #   custom_js   — page-level custom JS, preserved across canvas saves
  #
  # Custom code is stored separately from the canvas HTML so the builder's own Save (which
  # regenerates HTML from its element store) can never strip it — Framer's "Code component
  # ships on export" model. It's rendered as a <style> before and a <script> after the body.
  class BuilderBlockComponent < ViewComponent::Base
    def initialize(data:)
      @data = data || {}
      @html = @data["html"].to_s
    end

    def call
      return "" if @html.blank? && custom_css.blank? && custom_js.blank?

      # The builder's base design-kit vocabulary (the .cp-* hooks the templates emit) ships with
      # the theme; the page's custom CSS refines it. Element data is the source of truth.
      link = '<link rel="stylesheet" href="/page_builder_theme/ink-design-kit.css">'
      style = custom_css.present? ? "<style>#{custom_css}</style>" : ""
      script = custom_js.present? ? "<script>#{custom_js}</script>" : ""
      content = %(<div class="ink-builder-content">#{body_only}</div>)
      view_context.render(inline: link + style + content + script, type: :erb)
    end

    private

    def custom_css
      @data["custom_css"].to_s
    end

    def custom_js
      @data["custom_js"].to_s
    end

    # The builder saves a full HTML document (<html><head>…<body>…</body></html>); extract just
    # the <body> contents so it can be embedded inside the surrounding page template.
    def body_only
      body = @html[/<body[^>]*>(.*?)<\/body>/m, 1]
      body.presence || @html
    end
  end
end
