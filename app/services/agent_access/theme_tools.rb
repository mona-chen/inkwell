module AgentAccess
  module ThemeTools
    module_function

    ROUTE_VALUES = {
      title_override: { type: "string", maxLength: 300 },
      seo_title: { type: "string", maxLength: 300 },
      meta_description: { type: "string", maxLength: 1000 },
      canonical_url: { type: "string", maxLength: 2000 },
      robots: { type: "string", maxLength: 200 },
      status: { type: "string", enum: ThemeRoute::STATUSES },
      sitemap: { type: "boolean" },
      navigation_location: { type: [ "string", "null" ], enum: [ "header", "footer", nil ] },
      navigation_label: { type: "string", maxLength: 200 },
      navigation_position: { type: "integer" },
      social_image_id: { type: [ "integer", "null" ] },
      schema_json: { type: "object" },
      draft_data: { type: "object" }
    }.freeze

    def serialize(route)
      {
        id: route.id,
        path: route.path,
        route_key: route.route_key,
        theme_release_id: route.theme_release_id,
        title: route.display_title,
        status: route.status,
        published_at: route.published_at&.iso8601,
        revision: route.revision,
        updated_at: route.updated_at.iso8601(6),
        preview_url: "#{route.path.include?(':') ? '/' : route.path}?preview_theme=#{route.theme_release_id}",
        seo: route.seo_payload,
        navigation: {
          location: route.navigation_location,
          label: route.navigation_label,
          position: route.navigation_position
        }
      }
    end

    def tools
      definitions = []
      add = ->(name, scope, description, schema, read_only = false, &handler) do
        definitions << Inkwell::Mcp::Tool.new(name: "theme.#{name}", scope: scope, description: description, schema: schema, read_only: read_only, &handler)
      end

      add.call("routes_read", "theme:read", "List CMS routes for the active theme release, including SEO, publication state and optimistic-concurrency revision.", CoreTools.object({ status: { type: "string", enum: ThemeRoute::STATUSES } }), true) do |ctx, args|
        routes = ctx.site.theme_routes.where(theme_release_id: ctx.site.active_theme)
        routes = routes.where(status: args["status"]) if args["status"]
        { routes: routes.ordered.map { |route| serialize(route) } }
      end

      add.call("route_update_seo", "theme:write", "Update a theme route's title or SEO metadata. Requires the route revision (or updated_at) read moments ago. Never activates a release.", CoreTools.object({
        id: { type: "integer", minimum: 1 }, path: { type: "string" },
        expected_revision: { type: "integer", minimum: 0 }, expected_updated_at: { type: "string" },
        values: CoreTools.object(ROUTE_VALUES)
      }, [ "values" ])) do |ctx, args|
        raise Error, "Provide id or path" if args["id"].blank? && args["path"].blank?
        route = ctx.site.theme_routes.where(theme_release_id: ctx.site.active_theme).find_by(id: args["id"]) ||
          ctx.site.theme_routes.where(theme_release_id: ctx.site.active_theme).find_by(path: args["path"])
        raise Error, "Theme route not found in the active release" unless route
        route.with_lock do
          if args["expected_revision"].present? && route.revision != args["expected_revision"]
            raise Error, "Theme route changed. Read it again before editing."
          end
          if args["expected_updated_at"].present? && route.updated_at.iso8601(6) != args["expected_updated_at"]
            raise Error, "Theme route changed. Read it again before editing."
          end
          ctx.activity.before_state = serialize(route)
          values = args["values"].to_h.symbolize_keys.slice(*ROUTE_VALUES.keys.map(&:to_s).map(&:to_sym))
          raise Error, "No supported route fields supplied" if values.empty?
          route.update!(values)
          ctx.activity.after_state = serialize(route)
        end
        serialize(route.reload)
      end

      add.call("route_preview", "theme:read", "Return a preview URL for a theme route without changing the live release.", CoreTools.object({ id: { type: "integer", minimum: 1 } }, [ "id" ]), true) do |ctx, args|
        route = ctx.site.theme_routes.where(theme_release_id: ctx.site.active_theme).find(args["id"])
        path = route.path.include?(":") ? "/" : route.path
        { id: route.id, path: route.path, preview_path: "#{path}?preview_theme=#{route.theme_release_id}" }
      end

      add.call("parts_read", "theme:read", "Read the theme's declared parts and their release/override source. Content is truncated to 4 KB.", CoreTools.object({ key: { type: "string" } }), true) do |ctx, args|
        parts = ThemeRuntime::Parts.new(site: ctx.site, theme_slug: ctx.site.active_theme)
        keys = args["key"].present? ? [ args["key"] ] : parts.declarations.keys
        { parts: keys.filter_map do |key|
          part = parts.read(key)
          part&.merge(body: part[:body].to_s.truncate(4000))
        end }
      end

      add.call("editable_regions_read", "theme:read", "Read regions the theme explicitly exposes to Builder and any site override, without modifying the installed release.", CoreTools.object, true) do |ctx, _|
        { regions: ThemeRuntime::EditableRegions.new(site: ctx.site, theme_slug: ctx.site.active_theme).read }
      end

      add.call("release_build", "theme:release", "Queue an explicit deployment-time build for a theme source. Never runs package scripts during this request.", CoreTools.object({ slug: { type: "string" } })) do |ctx, args|
        slug = args["slug"].presence || ctx.site.active_theme
        runtime = ThemePackages::Runtime.for(slug)
        raise Error, "Theme package not found" unless runtime
        raise Error, "Theme has no package.json build script" unless runtime.root.join("package.json").file? && JSON.parse(runtime.root.join("package.json").read).dig("scripts", "build").present?
        ThemeBuildJob.perform_later(ctx.site.id, slug)
        ctx.activity.before_state = { "slug" => slug }
        ctx.activity.after_state = { "slug" => slug, "build" => "queued" }
        { slug: slug, status: "queued", readiness_errors: runtime.readiness_errors }
      end

      add.call("release_activate", "theme:release", "Explicitly activate an installed theme release. Requires the expected active release so a concurrent change is never overwritten.", CoreTools.object({ slug: { type: "string" }, expected_active_release: { type: "string" } }, [ "slug", "expected_active_release" ])) do |ctx, args|
        raise Error, "Active theme changed. Read the site again." unless ctx.site.active_theme == args["expected_active_release"]
        ctx.activity.before_state = { "active_theme" => ctx.site.active_theme }
        result = ThemeRuntime::Releases.activate!(site: ctx.site, slug: args["slug"])
        ctx.activity.after_state = { "active_theme" => ctx.site.reload.active_theme }
        { active_theme: ctx.site.active_theme, previous: result[:previous], routes: ctx.site.theme_routes.where(theme_release_id: ctx.site.active_theme).count }
      end

      add.call("release_rollback", "theme:release", "Explicitly restore the previously active theme release and audit the operation.", CoreTools.object({ expected_active_release: { type: "string" } }, [ "expected_active_release" ])) do |ctx, args|
        raise Error, "Active theme changed. Read the site again." unless ctx.site.active_theme == args["expected_active_release"]
        before = ctx.site.active_theme
        ctx.activity.before_state = { "active_theme" => before }
        result = ThemeRuntime::Releases.rollback!(site: ctx.site)
        ctx.activity.after_state = { "active_theme" => ctx.site.reload.active_theme }
        { active_theme: ctx.site.active_theme, rolled_back_from: before, previous: result[:previous] }
      end

      definitions
    end
  end
end
