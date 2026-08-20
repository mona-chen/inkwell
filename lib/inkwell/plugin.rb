module Inkwell
  # Mixin for plugin engines. Include this in a plugin's `lib/<name>/engine.rb` engine:
  #
  #   module Seo
  #     class Engine < ::Rails::Engine
  #       include Inkwell::Plugin
  #       isolate_namespace Seo
  #
  #       plugin_name "SEO Toolkit"
  #       plugin_description "Meta tags, sitemaps, and Open Graph for every post/page."
  #       plugin_version "1.0.0"
  #
  #       def on_activate
  #         Inkwell::Hooks.on_filter(:head_meta, source: plugin_slug) { |tags, post:| tags + Seo::MetaTagBuilder.new(post).tags }
  #       end
  #
  #       def on_deactivate
  #         Inkwell::Hooks.remove_source!(plugin_slug)
  #       end
  #     end
  #   end
  #
  # Engines must subclass `::Rails::Engine` *directly* so Rails' engine discovery
  # (`Rails::Engine.subclasses`, the railtie collection that wires view paths, migrations,
  # and routes) picks them up. `Inkwell::Plugin` is deliberately a module, not an engine
  # base class — an intermediate engine subclass would hide the real engines from Rails.
  module Plugin
    extend ActiveSupport::Concern

    class_methods do
      attr_reader :_plugin_name, :_plugin_description, :_plugin_version, :_admin_nav_items

      def plugin_name(val = nil)
        val ? (@_plugin_name = val) : @_plugin_name
      end

      def plugin_description(val = nil)
        val ? (@_plugin_description = val) : @_plugin_description
      end

      def plugin_version(val = nil)
        val ? (@_plugin_version = val) : @_plugin_version
      end

      # Called by a plugin to add an entry to the admin sidebar, e.g.:
      #   register_admin_nav(label: "SEO", path: "/admin/plugins/seo/settings", icon: "search")
      def register_admin_nav(label:, path:, icon: "puzzle-piece")
        (@_admin_nav_items ||= []) << { label: label, path: path, icon: icon }
      end

      # The stable identifier used for the InstalledPlugin record, admin routes, and hooks.
      # Defaults to the parameterized plugin_name, but plugins should set an explicit slug so
      # it survives display-name renames.
      def plugin_slug(val = nil)
        val ? (@_plugin_slug = val) : (@_plugin_slug || plugin_name.to_s.parameterize.underscore)
      end
    end

    def plugin_slug
      self.class.plugin_slug
    end

    # Subclasses override these.
    def on_activate; end
    def on_deactivate; end
  end
end
