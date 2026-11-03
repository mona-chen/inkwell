module ThemeRuntime
  # Builds the initial document for a static theme route: server-rendered
  # regions, route SEO, and a serialized data object before the theme bundle
  # runs. Client hydration and deferred islands read the same shape.
  class Document
    DATA_ID = "inkwell-data".freeze

    attr_reader :html, :data, :render_mode

    def initialize(html:, data:, render_mode: "server_injected", serializer: nil, warnings: [], site: nil, theme_slug: nil)
      @html = html
      @data = Contract.normalize(data)
      @render_mode = render_mode
      @serializer = serializer
      @warnings = warnings
      @site = site
      @theme_slug = theme_slug
    end

    def render
      document = Nokogiri::HTML5.parse(@html)
      if regions_renderable?
        Parts.new(site: @site, theme_slug: @theme_slug || @site&.active_theme).apply!(document) if @site
        Regions.new(data: @data, serializer: @serializer).render!(document)
      end
      Seo.new(document, @data.dig("page", "seo")).apply!
      inject_data(document)
      mark_mode(document)
      document.to_html
    end

    private

    def regions_renderable?
      render_mode == "server_injected"
    end

    def inject_data(document)
      document.css("script##{DATA_ID}").remove
      script = Nokogiri::XML::Node.new("script", document)
      script["type"] = "application/json"
      script["id"] = DATA_ID
      script["data-inkwell-contract"] = "1"
      script["data-inkwell-render-mode"] = render_mode
      json = JSON.generate(@data)
      script.content = ERB::Util.json_escape(json)
      head = document.at_css("head")
      (head || document.at_css("body") || document.root).prepend_child(script)
    end

    def mark_mode(document)
      head = document.at_css("head")
      return unless head

      head.css('meta[name="inkwell-rendering"]').remove
      head.add_child(Nokogiri::XML::Node.new("meta", document).tap do |meta|
        meta["name"] = "inkwell-rendering"
        meta["content"] = render_mode == "server_injected" ? "server" : "client"
      end)
      if render_mode != "server_injected"
        @warnings << "Theme route is client-rendered; initial indexing may be weaker"
        Rails.logger.warn("[ThemeRuntime] #{@warnings.last}")
      end
    end
  end
end
