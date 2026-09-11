# frozen_string_literal: true

module Multisite
  # Decides whether a plugin's hooks should run for the site currently active on the
  # request (Current.site). Two modes, configured per site by the multisite creator
  # (a platform superadmin) on the site's Plugins admin page:
  #
  #   :per_site (default) — a plugin runs for a site unless the creator explicitly
  #                         disabled it there (a SitePluginActivation with active:false).
  #                         Unmanaged plugins stay on — new sites inherit activations for
  #                         every globally-active plugin at creation time, and existing
  #                         sites keep working untouched. This is opt-out: "preserve what's
  #                         running, let the creator turn things off per site".
  #   :global            — the global InstalledPlugin.active? flag alone decides
  #                         (the pre-multisite behaviour).
  #
  # The gate is a no-op when there is no current site (background jobs, setup) or when
  # the multisite tables aren't present yet — hooks just run, matching core behaviour.
  class PluginGate
    GLOBAL  = "global"
    PER_SITE = "per_site"
    MODE_KEY = "plugins_mode"

    class << self
      def active_for_current_site?(slug)
        site = Current.site
        return true unless site

        cache = (Thread.current[:multisite_plugin_gate] ||= {})
        key = [ site.id, slug ]
        return cache[key] if cache.key?(key)

        cache[key] = active_for_site?(site, slug)
      rescue ActiveRecord::ActiveRecordError, NameError
        true
      end

      def active_for_site?(site, slug)
        record = InstalledPlugin.find_by(slug: slug)
        return false unless record&.active?
        return true if global_mode?(site)

        # per_site mode is opt-out: an explicit active:false disables the plugin for this
        # site; no row (or an active row) means it runs.
        activation = site.plugin_activations.find_by(installed_plugin_id: record.id)
        activation.blank? || activation.active?
      end

      def global_mode?(site)
        site.settings.fetch(MODE_KEY, PER_SITE) == GLOBAL
      end

      # Copy every currently globally-active plugin onto a brand-new site so per-site
      # mode starts from sensible defaults. Called after a site is provisioned.
      def provision_default_activations!(site)
        InstalledPlugin.where(active: true).find_each do |plugin|
          site.plugin_activations.find_or_create_by!(installed_plugin_id: plugin.id) do |activation|
            activation.active = true
          end
        end
      end
    end
  end
end
