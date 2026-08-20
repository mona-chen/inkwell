module PageBuilder
  class Engine < ::Rails::Engine
    include Inkwell::Plugin
    isolate_namespace PageBuilder

    plugin_name "Ink Builder"
    plugin_slug "page_builder"
    plugin_description "Drag-and-drop page builder that saves as ERB, so built sections can use dynamic data ({{ page.title }}, {{ loop posts:3 }})."
    plugin_version "1.0.0"

    register_admin_nav(label: "Ink Builder", path: "/builder", icon: "layout")

    config.to_prepare do
      ::BlockRenderer.register("page_builder", PageBuilder::BuilderBlockComponent)
      ::BlockRenderer.register_editor_partial("page_builder", "page_builder/blocks/builder")
      ::BlockRenderer.register_templates_partial("page_builder/templates")
    end
  end
end
