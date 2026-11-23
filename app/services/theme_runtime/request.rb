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
      @serializer ||= Serializer.new(site: site, base_url: base_url, paths: theme_paths)
    end

    # The theme's declared URL patterns for posts, authors and the blog index.
    def theme_paths
      manifest = runtime&.manifest
      return {} unless manifest

      templates = manifest.templates
      routes = manifest.routes
      pick = ->(role) { templates[role].presence.then { |path| path if path && routes.key?(path) } }
      { "post" => pick.call("blog_post"), "author" => pick.call("author"), "blog" => pick.call("blog_index") }.compact
    rescue StandardError
      {}
    end

    private

    def resolve
      return unless runtime

      overlay = theme_route_for(runtime.manifest.canonical_route(path))
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
        if record.is_a?(User)
          # Author pages list that author's stories (handled below).
        elsif record.is_a?(Post)
          posts = [ serializer.post_payload(record) ]
        else
          posts = listing { |metadata| pagination = metadata }
        end
      end
      if pagination.nil? && posts.empty? && !record.is_a?(Post) && (archive_page? || query[:q].present?)
        posts = listing { |metadata| pagination = metadata }
      end
      posts = serializer.posts(limit: 12, author: record) if record.is_a?(User) && posts.empty?
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
      seo["canonical"] = route&.canonical_url.presence || serializer.absolute_url(runtime.manifest.canonical_route(path))
      if record.is_a?(Post)
        # Articles: keep the JSON-LD graph and article meta built by the post payload.
        post_seo = data.dig("page", "seo") || {}
        # The theme's own post route is canonical (so /posts/x and /blog/x don't compete).
        seo["canonical"] = record.canonical_url_override.presence || (theme_paths["post"] ? serializer.absolute_url(data.dig("page", "url")) : seo["canonical"])
        seo["schema"] = post_seo["schema"] if post_seo["schema"].present?
        seo["og"] = (seo["og"] || {}).merge("type" => "article")
        seo["article"] = {
          "published_time" => data.dig("page", "published_at"),
          "modified_time" => data.dig("page", "modified_at") || data.dig("page", "updated_at"),
          "section" => data.dig("page", "category", "name"),
          "author" => data.dig("page", "author", "name")
        }.compact
        data["related"] = serializer.related_posts(record, limit: 3)
      elsif record.is_a?(User)
        seo = data.dig("page", "seo").merge("canonical" => seo["canonical"])
      end
      data["page"]["seo"] = seo
      data["categories"] = serializer.categories if archive_page? || record.is_a?(Post)
      data["filter"] = { "category" => query[:category].presence, "tag" => query[:tag].presence, "q" => query[:q].presence }
      data
    end

    # Blog listing honouring ?category=, ?tag=, ?q= and ?page=.
    def listing(&block)
      serializer.posts(limit: 12, search: query[:q], category: query[:category].presence, tag: query[:tag].presence, page: query[:page] || 1, &block)
    end

    def archive_page?
      match&.route&.route_key.to_s.match?(/blog|archive|index|home/) || path == "/" || (theme_paths["blog"].present? && path == theme_paths["blog"])
    end
  end
end
