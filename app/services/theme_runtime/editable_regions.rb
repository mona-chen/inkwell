module ThemeRuntime
  # Only regions explicitly declared in the manifest are exposed to the Builder.
  # Overrides are stored separately from the installed release and can be reset.
  class EditableRegions
    MAX_BYTES = 256.kilobytes

    attr_reader :site, :theme_slug

    def initialize(site:, theme_slug: site.active_theme)
      @site = site
      @theme_slug = theme_slug
    end

    def runtime
      @runtime ||= ThemePackages::Runtime.for(theme_slug)
    end

    def declarations
      runtime ? runtime.manifest.editable_regions : {}
    end

    def declared?(key)
      declarations.key?(key.to_s)
    end

    def definition(key)
      declarations[key.to_s]
    end

    def override_for(key)
      site.theme_region_overrides.find_by(theme_release_id: theme_slug, region_key: key.to_s)
    end

    def read
      declarations.map do |key, definition|
        override = override_for(key)
        {
          "key" => key,
          "type" => definition["type"],
          "builder" => definition.fetch("builder", true),
          "label" => definition["label"].presence || key.humanize,
          "data" => effective_data(key, override),
          "overridden" => override.present?,
          "revision" => override&.revision,
          "updated_at" => override&.updated_at&.iso8601
        }
      end
    end

    def preview_data
      { "theme" => theme_slug, "regions" => read }
    end

    def read_one(key)
      read.find { |region| region["key"] == key.to_s }
    end

    def write!(key, data)
      raise ThemePackages::Invalid, "Unknown editable region" unless declared?(key)
      raise ThemePackages::Invalid, "Editable region data is too large" if data.to_json.bytesize > MAX_BYTES

      override = site.theme_region_overrides.find_or_initialize_by(theme_release_id: theme_slug, region_key: key.to_s)
      override.data = data.is_a?(Hash) ? data : { "value" => data }
      override.revision += 1 unless override.new_record?
      override.save!
      override
    end

    def reset!(key)
      override_for(key)&.destroy!
    end

    private

    def effective_data(key, override)
      return override.data if override

      fixtures = ThemeRuntime::Fixtures.new(runtime.root, runtime.manifest.inkwell["fixtures"].presence || "inkwell/fixtures")
      fixtures.regions[key] || {}
    rescue ThemePackages::Invalid
      {}
    end
  end
end
