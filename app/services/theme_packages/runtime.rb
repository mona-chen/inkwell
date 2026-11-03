module ThemePackages
  class Runtime
    CONTENT_TYPES = {
      ".html" => "text/html", ".css" => "text/css", ".js" => "text/javascript", ".mjs" => "text/javascript",
      ".json" => "application/json", ".png" => "image/png", ".jpg" => "image/jpeg", ".jpeg" => "image/jpeg",
      ".svg" => "image/svg+xml", ".webp" => "image/webp", ".avif" => "image/avif", ".gif" => "image/gif",
      ".ico" => "image/x-icon", ".woff" => "font/woff", ".woff2" => "font/woff2", ".ttf" => "font/ttf",
      ".mp4" => "video/mp4", ".webm" => "video/webm", ".pdf" => "application/pdf", ".txt" => "text/plain",
      ".webmanifest" => "application/manifest+json"
    }.freeze

    attr_reader :manifest, :root

    def self.for(slug)
      return unless slug.to_s.match?(Manifest::SLUG)
      root = Rails.root.join("app/themes", slug)
      file = root.join("theme.json")
      return unless file.file?
      data = JSON.parse(file.read)
      return unless data["format"] == "inkwell-theme-v1"
      new(root, Manifest.new(data))
    end

    def initialize(root, manifest)
      @root, @manifest = Pathname.new(root), manifest
    end

    def readiness_errors
      errors = []
      dependencies = Dependencies.new(manifest.data.fetch("dependencies", {}))
      errors << "Install gems and restart Rails: #{dependencies.missing_gems.keys.join(', ')}" if dependencies.missing_gems.any?
      errors.concat(contract_errors)
      targets = manifest.routes.values + Array(manifest.data["spa_fallback"])
      targets.each do |target|
        file = manifest.kind == "static" ? public_root.join(target) : root.join(manifest.data.fetch("views", "views"), "#{target}.html.erb")
        errors << "Missing output #{target}; build the theme first" unless file.file?
      end
      manifest.data.fetch("imports", {}).each_value do |path|
        errors << "Missing module #{path}; build the theme first" unless public_root.join(path).file?
      end
      errors.uniq
    end

    def contract_errors
      errors = []
      if manifest.inkwell.key?("fixtures")
        begin
          ThemeRuntime::Fixtures.new(root, manifest.inkwell["fixtures"].presence || "inkwell/fixtures").validate!
        rescue ThemePackages::Invalid => error
          errors << error.message
        end
      end
      manifest.parts.each do |key, target|
        found = if manifest.kind == "static"
          candidates = [ "#{target}.html", target, "parts/#{target}.html", "parts/#{target}/index.html" ]
          candidates.any? do |candidate|
            public_root.join(candidate).file? || (candidate.start_with?("inkwell/") && root.join(candidate).file?)
          end
        else
          view_root = root.join(manifest.data.fetch("views", "views"))
          [ view_root.join("#{target}.html.erb"), view_root.join(File.dirname(target), "_#{File.basename(target)}.html.erb"), root.join(target) ].any?(&:file?)
        end
        errors << "Missing theme part #{key} (#{target})" unless found
      end
      errors
    end

    def render(controller, path, fallback: true)
      request = ThemeRuntime::Request.new(
        site: Current.site,
        path: path,
        theme_slug: manifest.slug,
        query: controller.params.to_unsafe_h.symbolize_keys.slice(:page, :q),
        preview: controller.params[:preview_theme] == manifest.slug && controller.current_user&.admin?,
        allow_spa_fallback: fallback,
        base_url: controller.request.base_url
      )
      match = request.match
      if match
        return false if match.target.blank?

        if manifest.kind == "rails"
          controller.instance_variable_set(:@site, Current.site)
          controller.instance_variable_set(:@theme_route, match.route)
          controller.instance_variable_set(:@theme_data, request.data)
          controller.render template: match.target, layout: "application"
        else
          render_html(controller, public_root.join(match.target), spa: match.fallback || match.target == manifest.data["spa_fallback"], request: request)
        end
        return true
      end
      # Asset requests must never receive the SPA shell, including missing chunks.
      return true if path != "/" && serve_asset(controller, path.delete_prefix("/"))

      false
    end

    def asset_file(relative)
      return unless manifest.safe_path?(relative)
      return if relative.split("/").any? { |part| part.start_with?(".") } || %w[package.json package-lock.json theme.json].include?(relative)
      file = public_root.join(relative)
      return unless CONTENT_TYPES[file.extname.downcase] && file.extname.downcase != ".html" && file.file?
      return unless file.realpath.to_s.start_with?("#{public_root.realpath}/")
      file
    end

    def serve_asset(controller, relative)
      # HTML in an asset namespace is allowed only for declared static documents
      # (for example an embedded product demo), and receives the same rewriting.
      if manifest.kind == "static" && manifest.routes.value?(relative) && File.extname(relative) == ".html"
        render_html(controller, public_root.join(relative))
        return true
      end
      file = asset_file(relative)
      return false unless file
      if manifest.data["asset_prefix"] && %w[.css .js .mjs .json .svg].include?(file.extname.downcase)
        controller.render body: resolve_asset_prefix(file.read), content_type: CONTENT_TYPES.fetch(file.extname.downcase)
      else
        controller.send_file file, type: CONTENT_TYPES.fetch(file.extname.downcase), disposition: "inline"
      end
      true
    end

    def resolve_asset_prefix(text)
      prefix = manifest.data["asset_prefix"]
      prefix ? text.gsub(prefix, "/theme-assets/#{manifest.slug}/") : text
    end

    def public_root = root.join(manifest.data.fetch("public", "public"))

    private

    def render_html(controller, file, spa: false, request: nil)
      document = Nokogiri::HTML5.parse(resolve_asset_prefix(file.read))
      source_path = "/#{file.relative_path_from(public_root)}"
      document.css("[src], link[href]").each do |node|
        attribute = node["src"] ? "src" : "href"
        value = node[attribute]
        next if value.blank? || value.start_with?("#", "//") || value.match?(%r{\A[a-z][a-z0-9+.-]*:}i)
        uri = URI.join("https://theme.invalid#{source_path}", value)
        relative = uri.path.delete_prefix("/")
        next unless asset_file(relative)
        node[attribute] = "/theme-assets/#{manifest.slug}/#{relative}#{uri.query ? "?#{uri.query}" : ''}#{uri.fragment ? "##{uri.fragment}" : ''}"
      rescue URI::InvalidURIError
        next
      end
      if spa && !document.at_css("base")
        # Relative navigation and bundle URLs keep a stable site-root base.
        base = Nokogiri::XML::Node.new("base", document)
        base["href"] = "/"
        document.at_css("head").prepend_child(base)
      end
      if controller.params[:preview_theme] == manifest.slug && controller.current_user&.admin?
        script = Nokogiri::XML::Node.new("script", document)
        script["src"] = controller.helpers.asset_path("theme_preview_navigation.js")
        script["defer"] = "defer"
        script["data-ink-theme-preview"] = manifest.slug
        script["data-routes"] = manifest.routes.keys.to_json
        document.at_css("body").add_child(script)
      end
      html = document.to_html
      if request
        html = ThemeRuntime::Document.new(
          html: html,
          data: request.data,
          render_mode: request.render_mode,
          serializer: request.serializer,
          site: Current.site,
          theme_slug: manifest.slug
        ).render
      end
      controller.render html: html.html_safe, layout: false, content_type: "text/html"
    end
  end
end
