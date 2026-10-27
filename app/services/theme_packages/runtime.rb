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

    def render(controller, path, fallback: true)
      target = manifest.routes[path]
      if target
        if manifest.kind == "rails"
          controller.instance_variable_set(:@site, Current.site)
          controller.render template: target, layout: "application"
        else
          render_html(controller, public_root.join(target), spa: target == manifest.data["spa_fallback"])
        end
        return true
      end
      # Asset requests must never receive the SPA shell, including missing chunks.
      return true if path != "/" && serve_asset(controller, path.delete_prefix("/"))
      if fallback && manifest.data["spa_fallback"] && File.extname(path).empty? && Manifest.route?(path)
        render_html(controller, public_root.join(manifest.data["spa_fallback"]), spa: true)
        return true
      end
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
      file = asset_file(relative)
      return false unless file
      controller.send_file file, type: CONTENT_TYPES.fetch(file.extname.downcase), disposition: "inline"
      true
    end

    private

    def public_root = root.join(manifest.data.fetch("public", "public"))

    def render_html(controller, file, spa: false)
      document = Nokogiri::HTML5.parse(file.read)
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
      html = document.to_html
      controller.render html: html.html_safe, layout: false, content_type: "text/html"
    end
  end
end
