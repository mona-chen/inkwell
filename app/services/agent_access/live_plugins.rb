module AgentAccess
  module LivePlugins
    module_function

    def validate_manifest!(manifest)
      schema = CoreTools.object({
        name: { type: "string", minLength: 1, maxLength: 100 }, version: { type: "string", minLength: 1, maxLength: 50 },
        css: { type: "string", maxLength: 65_536 }, javascript: { type: "string", maxLength: 65_536 },
        settings: { type: "object", maxProperties: 30, additionalProperties: { type: "object", properties: {
          type: { type: "string", enum: %w[string boolean number] }, description: { type: "string", maxLength: 300 }, default: {}
        }, required: ["type"], additionalProperties: false } }
      }, %w[name version])
      raise Error, "Invalid live plugin manifest" unless JSONSchemer.schema(schema).valid?(manifest)
      manifest.fetch("settings", {}).each do |key, definition|
        raise Error, "Invalid setting name" unless key.match?(/\A[a-z][a-z0-9_]{0,39}\z/)
        if definition.key?("default")
          raise Error, "Setting default has the wrong type" unless JSONSchemer.schema(definition.slice("type")).valid?(definition["default"])
        end
      end
    end

    def summary(plugin)
      { slug: plugin.slug, active_release_id: plugin.active_release_id, releases: plugin.releases.order(id: :desc).map { |release| { id: release.id, digest: release.digest, name: release.manifest["name"], version: release.manifest["version"] } } }
    end

    def tools
      tools = []
      add = ->(name, scope, description, schema, read_only = false, &handler) { tools << Inkwell::Mcp::Tool.new(name: "inkwell.#{name}", scope: scope, description: description, schema: schema, read_only: read_only, &handler) }
      add.call("plugins_list", "plugins:read", "List installed Rails engines, exposed tools, and versioned live frontend plugins. Rails source, gems and migrations require normal deployment/restart; live packages are CSS/JS plus typed settings.", CoreTools.object, true) do |ctx, _|
        { rails: Inkwell::PluginManager.discovered.map { |engine| { slug: engine.plugin_slug, version: engine.plugin_version, active: Registry.plugin_active?(ctx.site, engine.plugin_slug), tools: engine.mcp_tools.keys } }, live: ctx.site.live_plugins.includes(:releases).order(:slug).map { |plugin| summary(plugin) } }
      end
      add.call("plugin_stage", "plugins:deploy", "Stage an immutable live frontend plugin release. Does not activate. Supports public-page CSS/JavaScript and typed plugin settings with auto-discovered MCP tools. No Ruby, shell commands, dependencies or migrations.", CoreTools.object({ slug: { type: "string", pattern: "^[a-z][a-z0-9_]{0,39}$" }, manifest: { type: "object" } }, %w[slug manifest])) do |ctx, args|
        validate_manifest!(args["manifest"])
        plugin = ctx.site.live_plugins.find_or_create_by!(slug: args["slug"])
        release = plugin.releases.create!(manifest: args["manifest"], digest: Digest::SHA256.hexdigest(args["manifest"].to_json))
        summary(plugin).merge(staged_release_id: release.id)
      end
      add.call("plugin_activate", "plugins:deploy", "Activate a staged release immediately on new public page loads. Use any previous release ID to roll back; null disables it. Requires the current active release ID to prevent overwriting other deployments.", CoreTools.object({ slug: { type: "string" }, release_id: { type: ["integer", "null"] }, expected_active_release_id: { type: ["integer", "null"] } }, %w[slug release_id expected_active_release_id])) do |ctx, args|
        plugin = ctx.site.live_plugins.find_by!(slug: args["slug"])
        plugin.with_lock do
          raise Error, "Active release changed. List plugins again." unless plugin.active_release_id == args["expected_active_release_id"]
          release = plugin.releases.find(args["release_id"]) if args["release_id"]
          ctx.activity.before_state = { "slug" => plugin.slug, "active_release_id" => plugin.active_release_id }
          plugin.update!(active_release: release)
          ctx.activity.after_state = { "slug" => plugin.slug, "active_release_id" => plugin.active_release_id }
        end
        summary(plugin)
      end
      tools
    end

    def plugin_tools(site)
      site.live_plugins.where.not(active_release_id: nil).includes(:active_release).flat_map do |plugin|
        schema = plugin.active_release.manifest.fetch("settings", {})
        read = Inkwell::Mcp::Tool.new(name: "live.#{plugin.slug}.settings_read", scope: "plugins:read", read_only: true, description: "Read #{plugin.slug}'s public configuration.", schema: CoreTools.object) do |ctx, _|
          current = ctx.site.live_plugins.find(plugin.id)
          { settings: schema.transform_values { |definition| definition["default"] }.merge(current.settings.slice(*schema.keys)), updated_at: current.updated_at.iso8601(6) }
        end
        write = Inkwell::Mcp::Tool.new(name: "live.#{plugin.slug}.settings_update", scope: "settings:write", description: "Update #{plugin.slug}'s declared public configuration. Values are exposed to frontend JavaScript, so do not store secrets.", schema: CoreTools.object({ values: { type: "object", properties: schema.transform_values { |definition| definition.slice("type", "description") }, additionalProperties: false }, expected_updated_at: { type: "string" } }, %w[values expected_updated_at])) do |ctx, args|
          current = ctx.site.live_plugins.find(plugin.id)
          current.with_lock do
            ctx.check_version!(current, args["expected_updated_at"])
            current.update!(settings: current.settings.merge(args["values"]))
          end
          { settings: current.settings, updated_at: current.updated_at.iso8601(6) }
        end
        [read, write]
      end
    end

    def public_tags(site, nonce: nil)
      return "" unless site
      site.live_plugins.where.not(active_release_id: nil).includes(:active_release).order(:slug).map do |plugin|
        release = plugin.active_release
        next "" unless release
        nonce_attr = nonce.present? ? %( nonce="#{ERB::Util.html_escape(nonce)}") : ""
        css = release.manifest["css"].to_s.gsub("<") { "\\3c " }
        # JSON literals and JS source escape HTML's script terminator without altering JS operators.
        config = release.manifest.fetch("settings", {}).transform_values { |definition| definition["default"] }.merge(plugin.settings.slice(*release.manifest.fetch("settings", {}).keys))
        json = ERB::Util.json_escape({ slug: plugin.slug, settings: config }.to_json)
        js = release.manifest["javascript"].to_s.gsub(%r{</script}i) { '<\\/script' }
        %(<style data-ink-live-plugin="#{plugin.slug}"#{nonce_attr}>#{css}</style><script data-ink-live-plugin="#{plugin.slug}"#{nonce_attr}>(function(plugin){\n#{js}\n})(#{json});</script>)
      end.join
    end
  end
end
