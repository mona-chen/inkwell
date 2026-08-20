module PageBuilder
  class BuilderBlockComponent < ViewComponent::Base
    def initialize(data:)
      @html = data["html"].to_s
    end

    # The stored value is ERB produced by PageBuilder::ErbConverter from an admin-only builder
    # session — rendering it inline is intentional (the "custom code block" tradeoff).
    #
    # The builder saves a full HTML document (<html><head>…<body>…</body></html>); extract just
    # the <body> contents so it can be embedded inside the surrounding page template.
    def call
      return "" if @html.blank?

      view_context.render(inline: body_only, type: :erb)
    end

    private

    def body_only
      body = @html[/<body[^>]*>(.*?)<\/body>/m, 1]
      body.presence || @html
    end
  end
end
