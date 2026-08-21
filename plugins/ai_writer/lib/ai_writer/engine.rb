module AiWriter
  class Engine < ::Rails::Engine
    include Inkwell::Plugin
    isolate_namespace AiWriter

    plugin_name "Copilot"
    plugin_slug "ai_writer"
    plugin_description "A floating chat assistant that drafts, rewrites, and edits page content with any OpenAI-compatible API, right from the block editor."
    plugin_version "1.0.0"

    register_admin_nav(label: "Copilot", path: "/plugins/ai_writer/settings", icon: "sparkles")

    # The plugin's config/importmap.rb is registered in config/application.rb so importmap
    # evaluates it at boot; nothing else to wire here for assets.
    # Toolbar controls appear in the post/page editor only while the plugin is active.
    def on_activate
      ::BlockRenderer.register_editor_toolbar_partial("ai_writer/editor_toolbar")
    end

    def on_deactivate
      ::BlockRenderer.unregister_editor_toolbar_partial("ai_writer/editor_toolbar")
    end
  end
end
