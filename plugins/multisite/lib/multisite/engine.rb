require "multisite/site_resolver"
require "multisite/route_helpers"
require "multisite/plugin_gate"

module Multisite
  class Engine < ::Rails::Engine
    include Inkwell::Plugin
    isolate_namespace Multisite

    plugin_name "Multisite"
    plugin_slug "multisite"
    plugin_description "Multi-site management for Inkwell — run multiple sites from a single installation."
    plugin_version "1.0.0"

    register_admin_nav(label: "Sites", path: "/plugins/multisite/admin/sites", icon: "globe_2", admin_only: true, section: "Workspace")

    # Resolve the site only after the session middleware has run (so the admin's
    # site-switch session value is readable) AND after the Rails executor, which
    # otherwise wipes CurrentAttributes — Current.site must already be set when
    # Devise authenticates (Warden runs right after us).
    initializer "multisite.middleware" do |app|
      # Run after the session middleware so the site-switch session value is readable,
      # and after the Rails executor — which otherwise wipes CurrentAttributes and would
      # leave Current.site nil when Devise authenticates (Warden runs after us).
      app.middleware.insert_after(ActionDispatch::Session::CookieStore, Multisite::SiteResolver)
    end

    def on_activate
      # Admin chrome and canvas hang entirely off the app's design tokens — no bespoke CSS
      # needed for the switcher or admin pages. Per-site plugin gating is handled by
      # Multisite::PluginGate (loaded by the requires above), which Inkwell::Hooks
      # consults per fire/filter.
    end

    def on_deactivate
      Inkwell::Hooks.remove_source!(plugin_slug)
    end
  end
end
