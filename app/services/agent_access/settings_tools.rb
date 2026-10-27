module AgentAccess
  module SettingsTools
    KEYS = %w[custom_css custom_scripts_head custom_scripts_body builder_styles].freeze
    module_function

    def values(site)
      KEYS.to_h { |key| [key, site.setting(key, key == "builder_styles" ? {} : "")] }
    end

    def revision(values)
      Digest::SHA256.hexdigest(values.to_json)
    end

    def tools
      read = Inkwell::Mcp::Tool.new(name: "inkwell.settings_read", scope: "site:read", read_only: true, description: "Read public custom code and Builder theme styles, plus a revision for safe updates. Contains no private site settings.", schema: CoreTools.object) do |ctx, _|
        data = values(ctx.site)
        { values: data, revision: revision(data) }
      end
      string = { type: "string", maxLength: 65_536 }
      write = Inkwell::Mcp::Tool.new(name: "inkwell.settings_update", scope: "settings:write", description: "Update site-wide CSS, script tags or Builder theme defaults immediately. Code runs on public pages. Requires the revision from settings_read. Existing rendered Builder pages may need republishing to adopt theme style changes.", schema: CoreTools.object({ revision: { type: "string" }, values: CoreTools.object({ custom_css: string, custom_scripts_head: string, custom_scripts_body: string, builder_styles: { type: "object" } }) }, %w[revision values])) do |ctx, args|
        ctx.site.with_lock do
          previous = values(ctx.site)
          raise Error, "Settings changed. Read settings again." unless revision(previous) == args["revision"]
          changes = args["values"].deep_dup
          changes.each do |key, value|
            if key == "builder_styles"
              changes[key] = SiteDesignStyles.new(value).values
            else
              raise Error, "Code exceeds 64 KB" if value.bytesize > SiteCustomCss::MAX_BYTES
            end
          end
          ctx.activity.before_state = previous
          changes.each { |key, value| ctx.site.set_setting!(key, value) }
          ctx.activity.after_state = values(ctx.site)
        end
        data = values(ctx.site)
        { values: data, revision: revision(data) }
      end
      [read, write]
    end
  end
end
