module ThemeRuntime
  # Resolves a public request against the installed manifest and the CMS overlay.
  # Native pages/posts are resolved by the caller before this service; a theme
  # can never shadow admin, auth, API, Builder or plugin routes.
  class Request
    Match = Struct.new(:path, :target, :params, :route, :record, :fallback, :route_path, keyword_init: true) do
      def fallback? = !!fallback
    end

    attr_reader :site, :theme_slug, :path, :query, :preview, :allow_spa_fallback, :base_url

    def initialize(site:, path:, theme_slug: site.active_theme, query: {}, preview: false, allow_spa_fallback: true, base_url: nil)
      @site = site
      @theme_slug = theme_slug
      @path = path.to_s.start_with?("/") ? path.to_s : "/#{path}"
      @query = query
      @preview = preview
      @allow_spa_fallback = allow_spa_fallback
      @base_url = base_url.presence || site.url
    end

    def runtime
      @runtime ||= ThemePackages::Runtime.for(theme_slug)
    end

    def match
      return @match if defined?(@match)

      @match = resolve
    end

    def draft?
      match&.route&.status == "draft"
    end

    def unpublished?
      draft? && !preview
    end

    def render_mode
      return runtime&.manifest&.runtime || "server_injected" unless runtime

      route_mode = runtime.manifest.inkwell.fetch("route_runtime", {})[matched_route_path]
      route_mode.presence || runtime.manifest.runtime
    end

    def data
      @data ||= build_data
    end

    def document_model
      @document_model ||= begin
        base = runtime.public_root.join(match.target)
        html = runtime.resolve_asset_prefix(base.read)
        Document.new(html: html, data: data, render_mode: render_mode, serializer: serializer)
      end
    end

    def serializer
      @serializer ||= Serializer.new(site: site, base_url: base_url)
    end

    private

    def resolve
      return unless runtime

      overlay = theme_route_for(path)
      return draft_match(overlay) if overlay && !overlay.published? && !preview

      manifest_match = manifest_route_for(path)
      if manifest_match
        record = resolve_record(manifest_match[:route_path], manifest_match[:params])
        return if manifest_match[:params].key?("slug") && record.nil?

        return Match.new(path: path, target: manifest_match[:target], params: manifest_match[:params], route: overlay, record: record, route_path: manifest_match[:route_path])
      end

      if overlay && overlay.published?
        target = target_for_route_key(overlay.route_key)
        if target
          params = overlay.path_params(path)
          record = resolve_record(overlay.path, params)
          return if params.key?("slug") && record.nil?

          return Match.new(path: path, target: target, params: params, route: overlay, record: record, route_path: overlay.path)
        end
      end

      if allow_spa_fallback && runtime.manifest.data["spa_fallback"] && File.extname(path).empty? && ThemePackages::Manifest.route?(path)
        return Match.new(path: path, target: runtime.manifest.data["spa_fallback"], params: {}, fallback: true, route_path: nil)
      end

      nil
    end

    def draft_match(overlay)
      Match.new(path: path, target: nil, params: {}, route: overlay, route_path: overlay.path)
    end

    def manifest_route_for(candidate)
      routes = runtime.manifest.routes
      if routes.key?(candidate)
        return { route_path: candidate, target: routes[candidate], params: {} }
      end
      routes.each do |route_path, target|
        next unless route_path.include?(":")

        regex = Regexp.new("\\A#{Regexp.escape(route_path).gsub(/:([a-z_]+)/, '([^/]+)')}\\z")
        next unless regex.match?(candidate)

        names = route_path.scan(/:([a-z_]+)/).flatten
        values = candidate.match(regex).captures
        return { route_path: route_path, target: target, params: names.zip(values).to_h }
      end
      nil
    end

    def theme_route_for(candidate)
      ThemeRoute.match(site: site, path: candidate, release: theme_slug, preview: true)
    rescue ActiveRecord::StatementInvalid
      nil
    end

    def matched_route_path
      match&.route_path || match&.route&.path || match&.path
    end

    def target_for_route_key(key)
      runtime.manifest.routes.each do |route_path, target|
        return target if ThemeRoute.route_key_for(route_path, runtime.manifest.data, target) == key
      end
      templates = runtime.manifest.templates
      value = templates[key].to_s
      return unless value.present?

      candidates = [ value, "#{value}.html", "templates/#{value}.html", "templates/#{value}/index.html" ]
      candidates.find { |candidate| runtime.public_root.join(candidate).file? }
    end

    def resolve_record(route_path, params)
      slug = params["slug"].presence
      target = runtime.manifest.routes[route_path].to_s
      route_key = ThemeRoute.route_key_for(route_path, runtime.manifest.data, target)
      if slug
        return site.posts.published.friendly.find(slug) if route_key.include?("post") || target.match?(/post/i)
        return site.pages.published.find_by(slug: slug) if target.match?(/page/i)
        return site.users.active.find { |user| user.to_param == slug } if route_key.include?("author") || target.match?(/author/i)
        site.posts.published.friendly.find(slug)
      end
      nil
    rescue ActiveRecord::RecordNotFound
      nil
    end

    def build_data
      record = match&.record
      route = match&.route
      posts = []
      authors = []
      comments = []
      pagination = nil

      case match&.route&.route_key.to_s
      when /blog|archive|index|home/, ""
        if record.is_a?(Post)
          posts = [ serializer.post_payload(record) ]
        else
          posts = serializer.posts(limit: 10, search: query[:q], page: query[:page] || 1) { |metadata| pagination = metadata }
        end
      end
      if pagination.nil? && posts.empty? && !record.is_a?(Post) && (archive_page? || query[:q].present?)
        posts = serializer.posts(limit: 10, search: query[:q], page: query[:page] || 1) { |metadata| pagination = metadata }
      end
      posts = serializer.posts(limit: 10, author: record) if record.is_a?(User) && posts.empty?
      authors = serializer.authors(limit: 12) if record.is_a?(User) || route&.route_key.to_s.include?("author")
      comments = serializer.comments(record, limit: 50) if record.is_a?(Post)

      data = serializer.document(
        path: path,
        route: route,
        record: record,
        navigation_location: "header",
        posts: posts,
        authors: authors,
        comments: comments,
        pagination: pagination
      )
      seo = serializer.seo_payload(record: record, route: route, path: path)
      seo["canonical"] = route&.canonical_url.presence || serializer.absolute_url(path)
      data["page"]["seo"] = seo
      data
    end

    def archive_page?
      match&.route&.route_key.to_s.match?(/blog|archive|index|home/) || path == "/"
    end
  end
end
