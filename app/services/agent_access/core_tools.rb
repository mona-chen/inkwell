module AgentAccess
  module CoreTools
    module_function

    def object(properties = {}, required = [])
      { type: "object", properties: properties, required: required, additionalProperties: false }
    end

    def content_keys
      { kind: { type: "string", enum: %w[page post] }, id: { type: "integer", minimum: 1 } }
    end

    def serialize(record, details: false)
      result = { kind: record.is_a?(Page) ? "page" : "post", id: record.id, title: record.title, status: record.status, version: record.updated_at.iso8601(6), url: record.url, editor_url: "/builder/#{record.is_a?(Page) ? 'page' : 'post'}/#{record.id}", preview_url: "/builder/#{record.is_a?(Page) ? 'page' : 'post'}/#{record.id}/preview" }
      result.merge!(content: record.content_blocks, draft_content: record.draft_content, metadata: record.attributes.slice("seo_title", "seo_description", "seo_focus_keyword", "og_title", "og_description", "noindex", "nofollow")) if details
      result
    end

    def tools
      definitions = []
      add = ->(name, scope, description, schema, read_only = false, &handler) do
        definitions << Inkwell::Mcp::Tool.new(name: "inkwell.#{name}", scope: scope, description: description, schema: schema, read_only: read_only, &handler)
      end
      add.call("site", "site:read", "Inspect this site, theme and agent permissions. All tools are restricted to this site.", object, true) do |ctx, _|
        { id: ctx.site.id, name: ctx.site.name, theme: ctx.site.active_theme, scopes: ctx.credential.scopes, builder: "Visual designs use page_builder.workspace_read and workspace_patch. Open the returned editor URL to compile/preview shared drafts with the real Builder; workspace edits never publish themselves." }
      end
      add.call("content_list", "site:read", "List pages or posts, including drafts. Page through using offset.", object({ kind: { type: "string", enum: %w[page post] }, offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 100 } }, ["kind"]), true) do |ctx, args|
        scope = args["kind"] == "page" ? ctx.site.pages : ctx.site.posts
        scope = Pundit.policy_scope!(ctx.user, scope)
        { total: scope.count, items: scope.order(:id).offset(args.fetch("offset", 0)).limit(args.fetch("limit", 30)).map { |record| serialize(record) } }
      end
      add.call("content_read", "site:read", "Read live and draft content and its version before editing.", object(content_keys, %w[kind id]), true) do |ctx, args|
        serialize(ctx.record(args["kind"], args["id"]), details: true)
      end
      add.call("content_create", "content:write", "Create an unpublished page or post. Returns editor and preview URLs. Use the Builder workspace tools for visual design.", object({ kind: { type: "string", enum: %w[page post] }, title: { type: "string", minLength: 1, maxLength: 200 } }, %w[kind title])) do |ctx, args|
        scope = args["kind"] == "page" ? ctx.site.pages : ctx.site.posts
        record = scope.build(title: args["title"], author: ctx.user, status: "draft", content: [])
        ctx.authorize!(record, :create)
        record.save!
        serialize(record)
      end
      blocks = { type: "array", maxItems: 500, items: object({ type: { type: "string", minLength: 1 }, data: { type: "object" } }, %w[type data]) }
      add.call("content_save_draft", "content:write", "Save conventional content blocks as a draft, preserving the live version. Builder blocks must be edited through the Builder workspace tools. Requires current version.", object(content_keys.merge(version: { type: "string" }, blocks: blocks), %w[kind id version blocks])) do |ctx, args|
        record = ctx.record(args["kind"], args["id"])
        record.with_lock do
          ctx.authorize!(record, :update)
          ctx.check_version!(record, args["version"])
          raise Error, "Use the Builder workspace tools for pages containing Builder designs" if (record.editing_blocks + args["blocks"]).any? { |block| block["type"] == "page_builder" }
          known = BlockRenderer::REGISTRY.keys
          raise Error, "Unknown block type" unless args["blocks"].all? { |block| known.include?(block["type"]) }
          ctx.activity.before_state = ctx.snapshot(record)
          record.update!(draft_content: args["blocks"])
          ctx.activity.after_state = ctx.snapshot(record)
        end
        serialize(record, details: true)
      end
      metadata = { title: { type: "string", minLength: 1, maxLength: 200 }, seo_title: { type: "string", maxLength: 300 }, seo_description: { type: "string", maxLength: 1000 }, seo_focus_keyword: { type: "string", maxLength: 300 }, og_title: { type: "string", maxLength: 300 }, og_description: { type: "string", maxLength: 1000 }, noindex: { type: "boolean" }, nofollow: { type: "boolean" } }
      add.call("content_update_metadata", "content:write", "Update title and SEO metadata. These fields take effect immediately; published content also requires content:publish permission. Read current version first.", object(content_keys.merge(version: { type: "string" }, values: object(metadata)), %w[kind id version values])) do |ctx, args|
        record = ctx.record(args["kind"], args["id"])
        record.with_lock do
          ctx.authorize!(record, :update)
          ctx.check_version!(record, args["version"])
          if record.status == "published"
            ctx.require_scope!("content:publish")
            ctx.authorize!(record, :publish)
          end
          record.update!(args["values"])
        end
        serialize(record, details: true)
      end
      add.call("content_publish", "content:publish", "Publish the current draft explicitly. Requires current version. Compiles no Builder HTML; save visual edits in the real Builder first.", object(content_keys.merge(version: { type: "string" }), %w[kind id version])) do |ctx, args|
        record = ctx.record(args["kind"], args["id"])
        record.with_lock do
          ctx.authorize!(record, :publish)
          ctx.check_version!(record, args["version"])
          WorkspaceTools.require_compiled!(record, ctx.site)
          ctx.activity.before_state = ctx.snapshot(record)
          # Do not call publish_draft! with nil: its block merge can erase non-Builder content.
          record.update!(draft_content: record.content_blocks) if record.draft_content.nil?
          if record.draft_content.any? { |block| block["type"] == "page_builder" }
            # Compiled Builder drafts already contain the full authoritative payload;
            # the classic editor's preserving merge would substitute the older live block.
            attributes = { content: record.draft_content, draft_content: nil, status: "published" }
            attributes[:live_render_mode] = "native" if record.is_a?(Page)
            builder_title = record.draft_content.find { |block| block["type"] == "page_builder" }.dig("data", "store", "settings", "title")
            attributes[:title] = builder_title if builder_title.is_a?(String) && builder_title.present?
            record.update!(attributes)
            Inkwell::Hooks.fire(:page_published, record) if record.is_a?(Page)
          else
            record.is_a?(Page) ? record.publish_native! : record.publish_draft!
          end
          ctx.activity.after_state = ctx.snapshot(record)
        end
        serialize(record)
      end
      add.call("content_restore_draft", "content:write", "Restore the previous draft from an agent activity. Does not change live content. Refuses if draft changed since that activity.", object({ activity_id: { type: "integer", minimum: 1 } }, ["activity_id"])) do |ctx, args|
        event = ctx.site.agent_activities.find(args["activity_id"])
        raise Error, "This activity has no reversible draft" unless event.tool == "inkwell.content_save_draft" && event.status == "success" && event.before_state.present?
        record = ctx.record(event.before_state["kind"], event.before_state["id"])
        record.with_lock do
          ctx.authorize!(record, :update)
          raise Error, "Content changed since this activity" unless ctx.snapshot(record) == event.after_state
          ctx.activity.before_state = ctx.snapshot(record)
          record.update!(draft_content: event.before_state["draft_content"])
          ctx.activity.after_state = ctx.snapshot(record)
        end
        serialize(record)
      end
      add.call("activity_list", "site:read", "Read the latest 50 agent actions, without credentials or submitted code.", object, true) do |ctx, _|
        { activities: ctx.site.agent_activities.order(id: :desc).limit(50).as_json(only: %i[id tool status error_code created_at]) }
      end
      definitions
    end
  end
end
