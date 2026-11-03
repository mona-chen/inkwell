module ThemePackages
  class Manifest
    SLUG = /\A[a-z][a-z0-9_-]{0,63}\z/
    IDENTIFIER = /\A[a-z][a-z0-9_]*\z/
    DECLARATION_KEY = /\A(?:[a-z][a-z0-9_]*|404)\z/
    CONTRACT_VERSIONS = %w[1].freeze
    CONTENT_TYPES = %w[posts pages authors comments categories tags media].freeze
    REGION_TYPES = %w[site navigation posts post authors author comments search pagination seo].freeze
    EDITABLE_REGION_TYPES = %w[rich_text query html text image].freeze
    RUNTIME_MODES = %w[server_injected client_hydration data_endpoint].freeze
    RESERVED = %w[
      admin users api github builder plugins docs media assets rails
      theme-assets theme-islands sitemap.xml feed.xml signup new-site mcp
    ].freeze
    SERVER_CODE_KEYS = %w[controllers migrations initializers application middleware jobs models routes_file].freeze

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
      if data["asset_prefix"] && !(kind == "static" && data["asset_prefix"].is_a?(String) && data["asset_prefix"].match?(%r{\A/__inkwell_[a-z0-9_]+__/\z}))
        raise Invalid, "asset_prefix must be a static theme asset placeholder"
      end
      validate_contract!
      validate_server_code!
      Dependencies.new(data.fetch("dependencies", {})).validate!
    end

    def self.route?(route)
      route.is_a?(String) && route.start_with?("/") && !route.start_with?("//") &&
        !route.match?(/[?#\\\s]/) && !route.split("/").any? { |part| [ ".", ".." ].include?(part) } &&
        !reserved_path?(route)
    end

    def self.reserved_path?(path)
      first = path.to_s.split("/")[1].to_s
      RESERVED.include?(first)
    end

    def safe_path?(value)
      value.is_a?(String) && !value.empty? && !value.start_with?("/", ".") && !value.include?("\\") &&
        !value.split("/").any? { |part| [ "", ".", ".." ].include?(part) }
    end

    def slug = data.fetch("slug")
    def kind = data.fetch("kind")
    def routes = data.fetch("routes", {})

    def canonical_route(path)
      return path unless path.end_with?(".html") && routes.key?(path)

      clean = path.delete_suffix(".html")
      clean = clean.delete_suffix("/index").presence || "/" if clean.end_with?("/index")
      routes[clean] == routes[path] ? clean : path
    end

    def canonical_routes
      routes.select { |path, _| canonical_route(path) == path }
    end
    def inkwell = data.fetch("inkwell", {})
    def contract? = inkwell.is_a?(Hash) && inkwell.key?("contract")
    def contract_version = inkwell["contract"].to_s
    def parts = inkwell.fetch("parts", {})
    def templates = inkwell.fetch("templates", {})
    def content_types = Array(inkwell.fetch("content_types", []))
    def editable_regions = inkwell.fetch("editable_regions", {})
    def runtime = inkwell["runtime"].presence || "server_injected"

    private

    def validate_contract!
      return unless data.key?("inkwell")

      value = data["inkwell"]
      raise Invalid, "inkwell must be an object" unless value.is_a?(Hash)
      unless value.key?("contract") && CONTRACT_VERSIONS.include?(value["contract"].to_s)
        raise Invalid, "inkwell.contract must be one of #{CONTRACT_VERSIONS.join(', ')}"
      end
      validate_declarations!(value, "parts", parts, allow_route_key: true)
      validate_declarations!(value, "templates", templates, allow_route_key: true)

      content_types = value.fetch("content_types", [])
      unless content_types.is_a?(Array) && content_types.all? { |type| type.is_a?(String) } &&
             (content_types - CONTENT_TYPES).empty?
        raise Invalid, "inkwell.content_types must use #{CONTENT_TYPES.join(', ')}"
      end

      regions = value.fetch("editable_regions", {})
      raise Invalid, "inkwell.editable_regions must be an object" unless regions.is_a?(Hash)
      regions.each do |key, definition|
        raise Invalid, "Invalid editable region key: #{key}" unless key.to_s.match?(IDENTIFIER)
        raise Invalid, "Editable region #{key} must be an object" unless definition.is_a?(Hash)
        type = definition["type"]
        raise Invalid, "Editable region #{key} has an unsupported type" unless EDITABLE_REGION_TYPES.include?(type)
        if definition.key?("builder") && ![ true, false ].include?(definition["builder"])
          raise Invalid, "Editable region #{key}.builder must be true or false"
        end
      end

      runtime = value["runtime"]
      if runtime && !RUNTIME_MODES.include?(runtime)
        raise Invalid, "inkwell.runtime must be one of #{RUNTIME_MODES.join(', ')}"
      end

      route_runtime = value["route_runtime"]
      if route_runtime
        raise Invalid, "inkwell.route_runtime must be an object" unless route_runtime.is_a?(Hash)
        route_runtime.each do |path, mode|
          raise Invalid, "Unknown route runtime path: #{path}" unless routes.key?(path)
          raise Invalid, "Unknown runtime mode for #{path}" unless RUNTIME_MODES.include?(mode)
        end
      end

      fixture_dir = value["fixtures"]
      raise Invalid, "inkwell.fixtures must be a safe relative path" if fixture_dir && !safe_path?(fixture_dir)
    end

    def validate_declarations!(section, name, declarations, allow_route_key:)
      raise Invalid, "inkwell.#{name} must be an object" unless declarations.is_a?(Hash)

      declarations.each do |key, target|
        raise Invalid, "Invalid #{name} key: #{key}" unless key.to_s.match?(DECLARATION_KEY)
        next if target.is_a?(String) && safe_path?(target)
        next if allow_route_key && target.is_a?(String) && routes.key?(target)

        raise Invalid, "#{name}.#{key} must be a safe relative path or a declared route"
      end
      section
    end

    def validate_server_code!
      SERVER_CODE_KEYS.each do |key|
        raise Invalid, "Theme packages cannot declare #{key}" if data.key?(key)
      end
      return unless data.key?("inkwell")

      SERVER_CODE_KEYS.each do |key|
        raise Invalid, "Theme packages cannot declare executable server code" if data["inkwell"].key?(key)
      end
      if data["kind"] == "static" && data["inkwell"]["rails"] == true
        raise Invalid, "Static themes cannot declare Rails execution"
      end
    end
  end
end
