module ImportedSites
  # The original document owns its DOM and runtime. Only navigation and metadata are
  # adapted here; builder conversion remains a separate representation of the page.
  class Document
    def initialize(page, head_meta: [], origin: nil)
      @page = page
      @head_meta = head_meta
      @origin = origin || (page.site.domain.to_s.match?(%r{\Ahttps?://}) ? page.site.domain : "https://#{page.site.domain}")
      @origin = @origin.delete_suffix("/")
    end

    def render
      document = Nokogiri::HTML5.parse(@page.original_import_html)
      head = document.at_css("head")
      base = head.at_css("base") || Nokogiri::XML::Node.new("base", document).tap { |node| head.prepend_child(node) }
      base["href"] = URI.join(@page.original_import_url, base["href"].presence || @page.original_import_url).to_s
      rewrite_navigation(document, base["href"])

      document.css("title, meta[name='description'], meta[name='robots'], link[rel='canonical'], meta[property^='og:'], meta[name^='twitter:']").remove
      title = Nokogiri::XML::Node.new("title", document)
      title.content = @page.seo_title_display
      head.add_child(title)
      if @head_meta.any?
        # Inkwell's SEO hook owns structured data when enabled.
        document.css("script[type='application/ld+json']").remove
        @head_meta.each { |tag| head.add_child(tag.to_s) }
      else
        description = Nokogiri::XML::Node.new("meta", document)
        description["name"] = "description"
        description["content"] = @page.seo_description_display.to_s
        head.add_child(description)
        canonical = Nokogiri::XML::Node.new("link", document)
        canonical["rel"] = "canonical"
        canonical_path = @page.canonical_url
        origin = @page.site.domain.to_s
        origin = "https://#{origin}" unless origin.match?(%r{\Ahttps?://})
        canonical["href"] = URI.join("#{origin.delete_suffix('/')}/", canonical_path).to_s
        head.add_child(canonical)
        directives = %i[noindex nofollow].select { |key| @page.public_send(key) }.map(&:to_s)
        if directives.any?
          robots = Nokogiri::XML::Node.new("meta", document)
          robots["name"] = "robots"
          robots["content"] = directives.join(", ")
          head.add_child(robots)
        end
      end
      document.to_html
    end

    private

    def rewrite_navigation(document, base)
      routes = @page.site.pages.published.where.not(original_import_url: [nil, ""]).select(:id, :site_id, :slug, :public_path, :original_import_url, :meta).each_with_object({}) do |page, result|
        ([page.original_import_url] + Array(page.meta["import_source_aliases"])).each do |source|
          result[normalize(source)] = page.url
        end
      end
      document.css("a[href], area[href]").each do |node|
        href = node["href"]
        next if href.blank?
        if href.start_with?("#")
          node["href"] = "#{@origin}#{@page.url}#{href}"
          next
        end
        uri = URI.join(base, href)
        next unless %w[http https].include?(uri.scheme)
        destination = routes[normalize(uri.to_s)]
        node["href"] = "#{@origin}#{destination}#{uri.query ? "?#{uri.query}" : ''}#{uri.fragment ? "##{uri.fragment}" : ''}" if destination
      rescue URI::InvalidURIError
        next
      end
      install_navigation(document, routes)
    end

    def install_navigation(document, routes)
      script = Nokogiri::XML::Node.new("script", document)
      script["data-ink-preserved-navigation"] = "true"
      serialized = ERB::Util.json_escape(routes.to_json)
      script.content = <<~JS
        (() => {
          const routes = #{serialized};
          const localPaths = new Set(Object.values(routes));
          window.addEventListener('click', (event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
            const anchor = event.target.closest?.('a[href],area[href]');
            if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
            const url = new URL(anchor.href, document.baseURI);
            if (!['http:', 'https:'].includes(url.protocol)) return;
            const key = new URL(url); key.search = ''; key.hash = '';
            key.pathname = key.pathname.replace(/\\/index\\.html$/, '/').replace(/\\/$/, '');
            const normalized = key.origin + (key.pathname === '/' ? '' : key.pathname);
            const path = routes[normalized] || (url.origin === location.origin && localPaths.has(url.pathname) ? url.pathname : null);
            if (!path) return;
            event.preventDefault(); event.stopImmediatePropagation();
            if (path === location.pathname && url.search === location.search && url.hash) location.hash = url.hash;
            else location.assign(location.origin + path + url.search + url.hash);
          }, true);
        })();
      JS
      document.at_css("head").prepend_child(script)
    end

    def normalize(value)
      uri = URI.parse(value)
      uri.query = uri.fragment = nil
      uri.path = uri.path.sub(%r{/index\.html\z}, "/").sub(%r{/(?=\z)}, "")
      uri.to_s
    end
  end
end
