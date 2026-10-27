module ThemePackages
  class Manifest
    SLUG = /\A[a-z][a-z0-9_-]{0,63}\z/
    RESERVED = %w[admin users api builder plugins posts pages authors tags docs media assets rails theme-assets sitemap.xml feed.xml signup new-site].freeze
    attr_reader :data

    def initialize(data)
      @data = data
      raise Invalid, "theme.json must be an object" unless data.is_a?(Hash)
      raise Invalid, "Unsupported theme format" unless data["format"] == "inkwell-theme-v1"
      raise Invalid, "Theme slug must use lowercase letters, numbers, underscores or hyphens" unless data["slug"].to_s.match?(SLUG)
      raise Invalid, "Theme name is required" if data["name"].to_s.strip.empty?
      raise Invalid, "Theme kind must be rails or static" unless %w[rails static].include?(data["kind"])
      raise Invalid, "routes must be an object" unless routes.is_a?(Hash)
      routes.each do |route, target|
        raise Invalid, "Invalid or reserved route: #{route}" unless self.class.route?(route)
        raise Invalid, "Invalid route target" unless safe_path?(target)
      end
      raise Invalid, "spa_fallback requires a static theme" if data["spa_fallback"] && kind != "static"
      raise Invalid, "Invalid SPA entrypoint" if data["spa_fallback"] && !safe_path?(data["spa_fallback"])
      %w[views public source].each { |key| raise Invalid, "Invalid #{key} directory" if data[key] && !safe_path?(data[key]) }
      imports = data.fetch("imports", {})
      raise Invalid, "imports must map module names to theme public files" unless imports.is_a?(Hash) && imports.all? { |key, value| key.is_a?(String) && key.match?(%r{\A[@a-zA-Z0-9_./-]+\z}) && safe_path?(value) }
      if data["entrypoint"] && !imports.key?(data["entrypoint"])
        raise Invalid, "entrypoint must name a declared import"
      end
      Dependencies.new(data.fetch("dependencies", {})).validate!
    end

    def self.route?(route)
      route.is_a?(String) && route.start_with?("/") && !route.start_with?("//") &&
        !route.match?(/[?#\\\s]/) && !route.split("/").any? { |part| [".", ".."].include?(part) } &&
        !RESERVED.include?(route.split("/")[1])
    end

    def safe_path?(value)
      value.is_a?(String) && !value.empty? && !value.start_with?("/", ".") && !value.include?("\\") &&
        !value.split("/").any? { |part| ["", ".", ".."].include?(part) }
    end

    def slug = data.fetch("slug")
    def kind = data.fetch("kind")
    def routes = data.fetch("routes", {})
  end
end
