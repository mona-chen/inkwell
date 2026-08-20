module Inkwell
  # Discovers plugin Engines under /plugins (already autoloaded/eager-loaded by Rails since
  # each is added to config.paths in config/application.rb), and reconciles them against the
  # `InstalledPlugin` table, which tracks per-plugin active/inactive state — this is the only
  # bit of runtime state; the plugin *code* is just present on disk like any Rails engine.
  class PluginManager
    class << self
      # All plugin Engine classes found on disk, regardless of activation state.
      def discovered
        ::Rails::Engine.subclasses.select { |k| k.include?(Inkwell::Plugin) }
      end

      def find(slug)
        discovered.find { |engine| engine.instance.plugin_slug == slug }
      end

      # Called once at boot (config/initializers/inkwell.rb) — activates every plugin
      # that's marked active in the DB, wiring up its hooks for this process.
      def boot!
        return unless InstalledPlugin.table_exists?

        discovered.each do |engine_class|
          instance = engine_class.instance
          record = InstalledPlugin.find_or_create_by!(slug: instance.plugin_slug) do |p|
            p.name = engine_class.plugin_name
            p.version = engine_class.plugin_version
            p.active = false
          end
          instance.on_activate if record.active?
        end
      end

      def activate!(slug)
        engine_class = find(slug) or raise ActiveRecord::RecordNotFound, "no plugin `#{slug}`"
        record = InstalledPlugin.find_by!(slug: slug)
        return record if record.active?

        engine_class.instance.on_activate
        record.update!(active: true)
        Inkwell::Hooks.fire(:plugin_activated, slug)
        record
      end

      def deactivate!(slug)
        engine_class = find(slug) or raise ActiveRecord::RecordNotFound, "no plugin `#{slug}`"
        record = InstalledPlugin.find_by!(slug: slug)
        return record unless record.active?

        engine_class.instance.on_deactivate
        Inkwell::Hooks.remove_source!(slug) # belt & suspenders if a plugin forgets to clean up
        record.update!(active: false)
        Inkwell::Hooks.fire(:plugin_deactivated, slug)
        record
      end

      def admin_nav_items
        InstalledPlugin.where(active: true).flat_map do |record|
          engine_class = find(record.slug)
          engine_class&.instance_variable_get(:@_admin_nav_items) || []
        end
      end
    end
  end
end
