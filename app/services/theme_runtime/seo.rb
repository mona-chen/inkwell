module ThemeRuntime
  # Applies route/record SEO to the initial HTML. SPA routes receive the same
  # payload through the serialized contract before client hydration.
  class Seo
    def initialize(document, payload)
      @document = document
      @payload = payload || {}
    end

    def apply!
      head = @document.at_css("head")
      return @document unless head

      set_title(head)
      set_meta(head)
      set_canonical(head)
      set_schema(head)
      @document
    end

    private

    def set_title(head)
      title = @payload["title"].presence
      return if title.blank?

      node = head.at_css("title")
      if node
        node.content = title
      else
        head.prepend_child(Nokogiri::XML::Node.new("title", @document).tap { |tag| tag.content = title })
      end
    end

    def set_meta(head)
      replace_meta(head, "description", @payload["description"])
      replace_meta(head, "robots", @payload["robots"])
      og = @payload["og"] || {}
      replace_meta(head, "og:title", og["title"], property: true)
      replace_meta(head, "og:description", og["description"], property: true)
      replace_meta(head, "og:image", og["image"], property: true)
      replace_meta(head, "og:url", og["url"], property: true)
      replace_meta(head, "og:type", og["type"], property: true)
      twitter = @payload["twitter"] || {}
      replace_meta(head, "twitter:card", twitter["card"])
      replace_meta(head, "twitter:title", twitter["title"])
      replace_meta(head, "twitter:description", twitter["description"])
      replace_meta(head, "twitter:image", twitter["image"])
    end

    def set_canonical(head)
      canonical = @payload["canonical"].presence
      return if canonical.blank?

      head.css('link[rel="canonical"]').remove
      head.add_child(node_with("link", "rel" => "canonical", "href" => canonical))
    end

    def set_schema(head)
      schema = @payload["schema"]
      return if schema.blank?

      head.css('script[type="application/ld+json"][data-inkwell-seo]').remove
      script = Nokogiri::XML::Node.new("script", @document)
      script["type"] = "application/ld+json"
      script["data-inkwell-seo"] = "1"
      script.content = ERB::Util.json_escape(schema.is_a?(String) ? schema : JSON.generate(schema))
      head.add_child(script)
    end

    def replace_meta(head, name, value, property: false)
      return if value.blank?

      attribute = property ? "property" : "name"
      head.css("meta[#{attribute}=\"#{name}\"]").remove
      head.add_child(node_with("meta", attribute => name, "content" => value.to_s))
    end

    def node_with(name, attributes)
      Nokogiri::XML::Node.new(name, @document).tap do |node|
        attributes.each { |key, value| node[key] = value.to_s }
      end
    end
  end
end
