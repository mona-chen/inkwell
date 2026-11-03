module ThemeRuntime
  # Resolves declared theme parts independently of templates. A site-level
  # override wins over the immutable installed release and can be reset to it.
  class Parts
    attr_reader :site, :theme_slug

    def initialize(site:, theme_slug: site.active_theme)
      @site = site
      @theme_slug = theme_slug
    end

    def runtime
      @runtime ||= ThemePackages::Runtime.for(theme_slug)
    end

    def declarations
      runtime ? runtime.manifest.parts : {}
    end

    def override_for(key)
      site.theme_part_overrides.find_by(theme_release_id: theme_slug, part_key: key.to_s)
    end

    def apply!(document)
      document.css("[data-inkwell-part]").each do |node|
        part = read(node["data-inkwell-part"].to_s)
        next unless part && part[:body].present?

        node.inner_html = part[:body]
        node["data-inkwell-part-source"] = part[:source]
      end
      document
    end

    def read(key)
      declaration = declarations[key.to_s]
      return unless declaration

      if (override = override_for(key))
        return { key: key.to_s, source: "override", body: override.body.to_s, revision: override.revision, declaration: declaration }
      end

      body = if runtime.manifest.kind == "static"
        candidate_part_file(declaration)&.read
      end
      { key: key.to_s, source: "release", body: body.to_s, revision: nil, declaration: declaration }
    end

    def write!(key, body)
      declaration = declarations[key.to_s]
      raise ThemePackages::Invalid, "Unknown theme part" unless declaration
      raise ThemePackages::Invalid, "Theme part body is too large" if body.to_s.bytesize > 512.kilobytes

      override = site.theme_part_overrides.find_or_initialize_by(theme_release_id: theme_slug, part_key: key.to_s)
      override.body = body.to_s
      override.save!
      override
    end

    def reset!(key)
      override_for(key)&.destroy!
    end

    def candidate_part_file(declaration)
      root = runtime.public_root
      candidates = [ declaration, "#{declaration}.html", "parts/#{declaration}.html", "parts/#{declaration}/index.html", "#{declaration}/index.html" ]
      candidates.filter_map do |candidate|
        next unless runtime.manifest.safe_path?(candidate)
        path = candidate.start_with?("inkwell/") ? runtime.root.join(candidate) : root.join(candidate)
        path if path.file?
      end.find(&:itself)
    end
  end
end
