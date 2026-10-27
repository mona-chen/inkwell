module AgentAccess
  # Reuse the Builder's shared-draft model and conflict-aware patch engine. Do not
  # introduce a second renderer, registry or HTML-to-store reconstruction path.
  module WorkspaceTools
    module_function

    def pack(store, block)
      nodes = {}
      visit = lambda do |node|
        copy = node.deep_dup
        copy["id"] ||= SecureRandom.uuid
        children = copy.delete("children") || []
        copy["children"] = children.map { |child| visit.call(child) }
        nodes[copy["id"]] = copy
        copy["id"]
      end
      roots = Array(store["children"]).map { |node| visit.call(node) }
      { "nodes" => nodes, "roots" => roots, "settings" => store.fetch("settings", {}), "customCss" => block.dig("data", "custom_css").to_s, "customJs" => block.dig("data", "custom_js").to_s }
    end

    def saved_document(record)
      block = record.editing_blocks.find { |item| item["type"] == "page_builder" } || { "data" => {} }
      store = block.dig("data", "store") || { "settings" => { "title" => record.title }, "children" => [] }
      pack(store, block)
    end

    def require_compiled!(record, site)
      workspace = PageBuilder::Workspace.find_by(site: site, record_type: record.class.name, record_id: record.id)
      return unless workspace&.document.present?
      shared = workspace.document.deep_dup
      root = record.is_a?(Page) ? "@page" : "@post"
      { "customCss" => "custom_css", "customJs" => "custom_js" }.each_key do |key|
        shared[key] = PageBuilder::ErbConverter.convert(shared[key].to_s, document_root: root)
      end
      raise Error, "Builder shared draft has uncompiled changes. Open the editor and save its draft before publishing." unless saved_document(record) == shared
    end

    def workspace(ctx, args)
      record = ctx.record(args["kind"], args["id"])
      ctx.authorize!(record, :update)
      ws = PageBuilder::Workspace.find_or_create_by!(site: ctx.site, record_type: record.class.name, record_id: record.id)
      ws.with_lock do
        ws.update!(document: saved_document(record)) if ws.document.empty?
      end
      [record, ws]
    end

    def read(ctx, args)
      record, ws = workspace(ctx, args)
      { revision: ws.revision, document: ws.document, editor_url: CoreTools.serialize(record)[:editor_url], compiled: saved_document(record) == ws.document, guidance: "Native shared document. Patch with expected before/existed values. Open the editor to render and save, then preview. Element definitions belong to window.builder.copilotTools.get_capabilities in the real editor. Never submit compiled HTML as a substitute for native nodes." }
    end

    def restore(ctx, args)
      event = ctx.site.agent_activities.find(args["activity_id"])
      raise Error, "This activity has no Builder change to restore" unless event.tool == "page_builder.workspace_patch" && event.status == "success" && event.before_state["workspace_id"]
      ws = PageBuilder::Workspace.find_by!(id: event.before_state["workspace_id"], site: ctx.site)
      kind = ws.record_type == "Page" ? "page" : "post"
      record = ctx.record(kind, ws.record_id)
      ctx.authorize!(record, :update)
      ws.with_lock do
        raise Error, "Workspace changed since this activity" unless ws.document == event.after_state["document"]
        ctx.activity.before_state = { "workspace_id" => ws.id, "document" => ws.document.deep_dup }
        PageBuilder::Workspace.validate_document!(event.before_state["document"])
        ws.update!(document: event.before_state["document"], revision: ws.revision + 1)
        ctx.activity.after_state = { "workspace_id" => ws.id, "document" => ws.document.deep_dup }
      end
      read(ctx, { "kind" => kind, "id" => record.id })
    end

    def patch(ctx, args)
      record, ws = workspace(ctx, args)
      ws.with_lock do
        raise Error, "Workspace changed; read it again" unless ws.revision == args["revision"]
        ctx.activity.before_state = { "workspace_id" => ws.id, "document" => ws.document.deep_dup }
        args["operations"].each do |operation|
          BuilderSafety.validate!(operation["path"], client_code: true)
          BuilderSafety.validate!(operation["value"], client_code: ctx.credential.allows?("settings:write"), path: operation["path"]) if operation.key?("value")
        end
        conflicts = ws.patch!(args["operations"])
        raise Error, "Workspace property conflicts; read it again" if conflicts.any?
        ws.save!
        ctx.activity.after_state = { "workspace_id" => ws.id, "document" => ws.document.deep_dup }
      end
      read(ctx, args)
    end
  end
end
