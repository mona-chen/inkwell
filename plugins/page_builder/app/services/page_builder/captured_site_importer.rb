require "set"

module PageBuilder
  class CapturedSiteImporter
    def initialize(site:, user:, capture_id:, captures_root: Rails.root.join("tmp", "site-captures"))
      @site = site
      @user = user
      @capture_id = capture_id
      @captures_root = Pathname.new(captures_root)
    end

    def import!(site_payload, preserve_existing: true)
      pages = coalesce_routes(site_payload)
      existing_by_source = if preserve_existing
        site.pages.where.not(original_import_url: [nil, ""]).index_by(&:original_import_url)
      else
        site.pages.where("meta ->> 'import_capture' = ?", capture_id).index_by { |page| page.meta["import_source"] }
      end
      if preserve_existing
        pages.each do |payload|
          existing_by_source[payload["source"]] ||= site.pages.where.not(original_import_url: [nil, ""]).find_by(public_path: source_path(payload["source"]))
        end
      end
      refreshed_ids = Set.new
      reserved_slugs = site.pages.pluck(:slug).to_set
      desired_slugs = pages.to_h do |page|
        existing = existing_by_source[page["source"]]
        slug = existing&.slug || unique_import_slug(page.fetch("slug"), reserved_slugs)
        reserved_slugs << slug
        [page.fetch("slug"), slug]
      end
      by_source = {}

      Page.transaction do
        site_parts = site_payload.fetch("siteParts", {}).deep_dup
        site_parts.each_value { |node| rewrite_import_links!([node], desired_slugs) }
        site.set_builder_site_parts!(site_parts.transform_values { |node| materialize_import_node(node) }) if site_parts.present? && !(preserve_existing && existing_by_source.values.compact.any?)

        pages.each_with_index do |page_payload, index|
          existing = existing_by_source[page_payload["source"]]
          if preserve_existing && existing
            selected_source = existing.meta["import_preservation_source"].presence || page_payload["source"]
            existing.original_import_html = imported_source_html(selected_source)
            raise KeyError, "Selected preservation source was not captured: #{selected_source}" if existing.original_import_html.blank?
            ImportedSites::SourceMetadata.seed(existing, only_missing: true)
            existing.update!(
              original_import_html: existing.original_import_html,
              original_import_url: selected_source,
              public_path: existing.public_path.presence || source_path(page_payload["source"]),
              meta: existing.meta.merge("import_capture" => capture_id,
                "import_source_aliases" => (Array(existing.meta["import_source_aliases"]) + Array(page_payload["sourceAliases"]) + [page_payload["source"], existing.original_import_url]).uniq)
            )
            refreshed_ids << existing.id
            by_source[page_payload["source"]] = existing
            next
          end
          payload = page_payload.fetch("payload").deep_dup
          rewrite_import_links!(payload.fetch("children"), desired_slugs)
          store = {
            "version" => 2,
            "type" => "page",
            "settings" => payload.fetch("settings", {}).merge("title" => page_payload.fetch("title")),
            "children" => payload.fetch("children").map { |node| materialize_import_node(node) }
          }
          block = {
            "type" => "page_builder",
            "data" => {
              "html" => ErbConverter.convert(rewrite_import_html_links(payload["initialHtml"].to_s, desired_slugs), document_root: "@page"),
              "store" => store,
              "custom_css" => payload["customCss"].to_s,
              "custom_js" => payload["customJs"].to_s
            }
          }
          page = existing_by_source[page_payload["source"]] || site.pages.build(author: user)
          original_html = imported_source_html(page_payload["source"])
          page.assign_attributes(
            author: user,
            title: page_payload.fetch("title"),
            slug: desired_slugs.fetch(page_payload.fetch("slug")),
            public_path: source_path(page_payload.fetch("source")),
            status: "draft",
            template: "landing",
            hide_title: true,
            menu_order: index,
            content: [block],
            meta: { "import_source" => page_payload["source"], "import_capture" => capture_id, "import_source_aliases" => page_payload["sourceAliases"] || [] },
            original_import_html: original_html,
            original_import_url: page_payload["source"],
            live_render_mode: "native"
          )
          ImportedSites::SourceMetadata.seed(page) if page.new_record? && original_html.present?
          page.save!
          by_source[page_payload["source"]] = page
        end

        pages.each do |page_payload|
          page = by_source[page_payload["source"]]
          next if refreshed_ids.include?(page.id)
          parent = by_source[page_payload["parentSource"]]
          page.update!(parent: parent) if parent && page.parent_id != parent.id
        end
      end

      pages.map do |page_payload|
        page = by_source.fetch(page_payload["source"])
        { id: page.id, title: page.title, slug: page.slug, source: page_payload["source"], builder_url: "/builder/page/#{page.id}" }
      end
    end

    private

    attr_reader :site, :user, :capture_id, :captures_root

    def source_path(url)
      URI.parse(url).path.presence || "/"
    end

    # A sibling CMS domain can link back to the same site's homepage/navigation.
    # Keep the primary origin's document for a colliding path and retain the other
    # source URLs as navigation aliases instead of creating conflicting pages.
    def coalesce_routes(site_payload)
      raise KeyError, "Capture contains no pages" if site_payload.fetch("pages").empty?
      primary_host = URI.parse(site_payload["source"].presence || site_payload.fetch("pages").first.fetch("source")).host
      site_payload.fetch("pages").group_by { |page| source_path(page.fetch("source")) }.values.map do |group|
        chosen = (group.find { |page| URI.parse(page.fetch("source")).host == primary_host } || group.first).deep_dup
        chosen["sourceAliases"] = (group.flat_map { |page| [page.fetch("source")] + Array(page["sourceAliases"]) } - [chosen.fetch("source")]).uniq
        chosen
      end
    end

    def unique_import_slug(desired, reserved)
      base = desired.to_s.parameterize.presence || "imported-page"
      candidate = base
      suffix = 2
      while reserved.include?(candidate) || site.pages.exists?(slug: candidate)
        candidate = "#{base}-#{suffix}"
        suffix += 1
      end
      candidate
    end

    def imported_source_html(source_url)
      @source_manifests ||= Dir.glob(captures_root.join(capture_id, "pages", "*", "manifest.json").to_s).each_with_object({}) do |path, result|
        result[JSON.parse(File.read(path))["source"]] = path
      rescue JSON::ParserError
        next
      end
      manifest_path = @source_manifests[source_url]
      return unless manifest_path

      source_path = Pathname.new(manifest_path).dirname.join("source.html")
      return unless source_path.file?

      html = source_path.read
      base = %(<base href="#{ERB::Util.html_escape(source_url)}">)
      return html if html.match?(/<base\b/i)
      return html.sub(/<head([^>]*)>/i, "<head\\1>#{base}") if html.match?(/<head([^>]*)>/i)

      "<!doctype html><html><head>#{base}</head><body>#{html}</body></html>"
    end

    def rewrite_import_links!(nodes, slugs)
      Array(nodes).each do |node|
        url = node.dig("settings", "url")
        if url.to_s.start_with?("/pages/")
          desired = url.delete_prefix("/pages/")
          node["settings"]["url"] = "/pages/#{slugs.fetch(desired, desired)}"
        end
        rewrite_import_links!(node["children"], slugs)
      end
    end

    def rewrite_import_html_links(html, slugs)
      slugs.reduce(html.to_s) do |result, (desired, actual)|
        result.gsub(%r{(?<=["'])/pages/#{Regexp.escape(desired)}(?=(?:[?#][^"']*)?["'])}, "/pages/#{actual}")
      end
    end

    def materialize_import_node(node)
      materialized = {
        "id" => SecureRandom.uuid,
        "type" => node.fetch("type"),
        "settings" => node.fetch("settings", {}).deep_dup,
        "styles" => node.fetch("styles", {}),
        "children" => Array(node["children"]).map { |child| materialize_import_node(child) }
      }
      bind_imported_background!(materialized)
      materialized
    end

    def bind_imported_background!(node)
      return unless node["type"] == "container"
      layer = Array(node["children"]).find { |child| child.dig("settings", "importedLabel").to_s.match?(/background(?: image)?/i) }
      image = imported_descendant(layer, "image")
      node["settings"]["importedBackgroundImageId"] = image.fetch("id") if image
    end

    def imported_descendant(node, type)
      return unless node
      return node if node["type"] == type
      Array(node["children"]).each do |child|
        match = imported_descendant(child, type)
        return match if match
      end
      nil
    end
  end
end
