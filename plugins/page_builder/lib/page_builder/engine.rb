module PageBuilder
  class Engine < ::Rails::Engine
    include Inkwell::Plugin
    isolate_namespace PageBuilder

    plugin_name "Ink Builder"
    plugin_slug "page_builder"
    plugin_description "Drag-and-drop page builder that saves as ERB, so built sections can use dynamic data ({{ page.title }}, {{ loop posts:3 }})."
    plugin_version "1.0.0"

    register_admin_nav(label: "Ink Builder", path: "/builder", icon: "layout", section: "Site")

    register_mcp_tool(name: "workspace_read", scope: "site:read", read_only: true,
      description: "Read a native Builder shared draft, revision, editor URL, and compilation state.",
      schema: { type: "object", properties: { kind: { type: "string", enum: %w[page post] }, id: { type: "integer", minimum: 1 } }, required: %w[kind id], additionalProperties: false }) do |context, args|
      AgentAccess::WorkspaceTools.read(context, args)
    end

    register_mcp_tool(name: "workspace_patch", scope: "builder:write",
      description: "Apply conflict-aware native Builder edits to its shared draft. Existing editors sync them live. Does not publish; open returned editor URL and save to compile. Use workspace_read first.",
      schema: { type: "object", properties: { kind: { type: "string", enum: %w[page post] }, id: { type: "integer", minimum: 1 }, revision: { type: "integer", minimum: 0 }, operations: { type: "array", maxItems: 500, items: { type: "object", properties: { path: { type: "array", items: { type: "string" }, maxItems: 40 }, before: {}, existed: { type: "boolean" }, value: {}, remove: { type: "boolean" } }, required: %w[path existed], additionalProperties: false } } }, required: %w[kind id revision operations], additionalProperties: false }) do |context, args|
      AgentAccess::WorkspaceTools.patch(context, args)
    end

    register_mcp_tool(name: "workspace_restore", scope: "builder:write",
      description: "Restore a previous agent workspace patch as a new shared revision. Refuses if another editor changed the design since that activity.",
      schema: { type: "object", properties: { activity_id: { type: "integer", minimum: 1 } }, required: ["activity_id"], additionalProperties: false }) do |context, args|
      AgentAccess::WorkspaceTools.restore(context, args)
    end

    config.to_prepare do
      ::BlockRenderer.register("page_builder", PageBuilder::BuilderBlockComponent)
      ::BlockRenderer.register_editor_partial("page_builder", "page_builder/blocks/builder")
      ::BlockRenderer.register_templates_partial("page_builder/templates")
    end
  end
end
