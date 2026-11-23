module AgentAccess
  module CoreTools
    module_function

    def object(properties = {}, required = [])
      { type: "object", properties: properties, required: required, additionalProperties: false }
    end

    def content_keys
      { kind: { type: "string", enum: %w[page post] }, id: { type: "integer", minimum: 1 } }
    end

    POST_METADATA = %w[excerpt seo_title seo_description seo_focus_keyword seo_slug_override og_title og_description og_image_url twitter_title twitter_description twitter_image_url canonical_url_override schema_article_type featured_image_id featured_image_alt cornerstone noindex nofollow scheduled_for].freeze
    PAGE_METADATA = %w[seo_title seo_description seo_focus_keyword og_title og_description noindex nofollow].freeze

    def serialize(record, details: false)
      kind = record.is_a?(Page) ? "page" : "post"
      result = { kind: kind, id: record.id, title: record.title, slug: record.slug, status: record.status, version: record.updated_at.iso8601(6), url: public_path(record), editor_url: (kind == "post" ? "/admin/posts/#{record.to_param}/edit" : "/builder/page/#{record.id}"), preview_url: "/builder/#{kind}/#{record.id}/preview" }
      return result unless details

      keys = record.is_a?(Post) ? POST_METADATA : PAGE_METADATA
      result[:content] = record.content_blocks
      result[:draft_content] = record.draft_content
      result[:metadata] = record.attributes.slice(*keys).transform_values { |value| value.respond_to?(:iso8601) ? value.iso8601 : value }
      if record.is_a?(Post)
        result[:published_at] = record.published_at&.iso8601
        result[:author] = { id: record.author_id, name: record.author&.name }
        result[:categories] = record.categories.order(:name).map { |term| term.slice(:id, :name, :slug) }
        result[:tags] = record.tags.order(:name).map { |term| term.slice(:id, :name, :slug) }
        result[:featured_image_url] = record.featured_image_url
        result[:reading_time] = [ (ContentDocument.new(record.editing_blocks).words.size / 220.0).ceil, 1 ].max
        result[:seo_checks] = seo_checks(record)
      end
      result
    end

    # The post's public URL on the active theme (e.g. /blog/slug), else the core route.
    def public_path(record)
      return record.url unless record.is_a?(Post)
      ThemeRuntime::Request.new(site: record.site, path: "/").serializer.post_path(record)
    rescue StandardError
      record.url
    end

    # A pre-publish editorial checklist computed from the working draft.
    def seo_checks(post)
      blocks = post.editing_blocks
      doc = ContentDocument.new(blocks)
      types = blocks.map { |block| block["type"] }
      title = post.seo_title_display.to_s
      description = post.seo_description.presence || post.excerpt.to_s
      images = doc.images
      checks = []
      add = ->(id, ok, message) { checks << { id: id, ok: ok, message: message } }
      add.call("title_length", title.length.between?(30, 65), "SEO title is #{title.length} characters (aim for 30–65).")
      add.call("description", description.length.between?(70, 165), "Meta description/excerpt is #{description.length} characters (aim for 70–165).")
      add.call("excerpt", post.excerpt.present?, "An excerpt is set (used on cards and as the article dek).")
      add.call("featured_image", post.featured_image_url.present?, "A featured image is set (cards, social previews, article cover).")
      add.call("featured_image_alt", post.featured_image_url.blank? || post.featured_image_alt.present? || post.featured_image&.alt_text.present?, "The featured image has alt text.")
      add.call("headings", doc.headings >= 2, "The article has at least two section headings (#{doc.headings} found) for structure and the table of contents.")
      add.call("image_alt", images.all? { |image| image["alt"].to_s.strip.present? }, "Every image has alt text (#{images.count { |image| image['alt'].to_s.strip.empty? }} missing).")
      add.call("length", doc.words.size >= 600, "Body is #{doc.words.size} words (long-form guides usually need 600+).")
      add.call("links", doc.links >= 2, "The article links to related pages or sources (#{doc.links} links).")
      add.call("category", post.categories.exists?, "The post has a category.")
      add.call("focus_keyword", post.seo_focus_keyword.blank? || title.downcase.include?(post.seo_focus_keyword.downcase), "The focus keyword appears in the SEO title.")
      add.call("takeaways", doc.words.size < 1200 || types.include?("takeaways"), "Long posts open with a Key takeaways block.")
      add.call("faq", doc.words.size < 1200 || types.include?("faq"), "Long posts end with an FAQ block (earns FAQ rich results).")
      checks
    end

    def assign_terms!(ctx, record, taxonomy, names)
      terms = Array(names).map(&:to_s).map(&:strip).reject(&:empty?).uniq.first(taxonomy == "category" ? 3 : 15).map do |name|
        slug = name.parameterize.presence || raise(Error, "Invalid #{taxonomy} name: #{name}")
        ctx.site.terms.find_by(taxonomy: taxonomy, slug: slug) || ctx.site.terms.create!(taxonomy: taxonomy, slug: slug, name: name)
      end
      record.post_terms.joins(:term).where(terms: { taxonomy: taxonomy }).destroy_all
      terms.each { |term| record.post_terms.create!(term: term) }
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
      max_media_bytes = 10.megabytes
      add.call("media_upload", "content:write", "Upload a PNG, JPEG, WebP, GIF or PDF from base64. Returns the media ID and URL for image blocks and featured images. Maximum 10 MB.", object({
        filename: { type: "string", minLength: 1, maxLength: 255 },
        base64: { type: "string", minLength: 4, maxLength: 4 * ((max_media_bytes + 2) / 3) },
        alt: { type: "string", maxLength: 500 }
      }, %w[filename base64])) do |ctx, args|
        item = ctx.site.media_items.build(uploaded_by: ctx.user, alt_text: args["alt"])
        begin
          bytes = Base64.strict_decode64(args["base64"])
        rescue ArgumentError
          raise Error, "Invalid base64 data"
        end
        raise Error, "File exceeds 10 MB" if bytes.bytesize > max_media_bytes
        io = StringIO.new(bytes)
        type = Marcel::MimeType.for(io)
        raise Error, "Unsupported file type" unless %w[image/png image/jpeg image/webp image/gif application/pdf].include?(type)
        io.rewind
        item.file.attach(io: io, filename: args["filename"], content_type: type, identify: false)
        item.save!
        item.library_json
      end
      add.call("content_create", "content:write", "Create an unpublished page or post. Read inkwell.content_guide first for the block vocabulary and editorial standards. Optional slug and excerpt apply to posts.", object({ kind: { type: "string", enum: %w[page post] }, title: { type: "string", minLength: 1, maxLength: 200 }, slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", maxLength: 120 }, excerpt: { type: "string", maxLength: 400 } }, %w[kind title])) do |ctx, args|
        scope = args["kind"] == "page" ? ctx.site.pages : ctx.site.posts
        attributes = { title: args["title"], author: ctx.user, status: "draft", content: [] }
        attributes[:slug] = args["slug"] if args["slug"].present?
        attributes[:excerpt] = args["excerpt"] if args["excerpt"].present? && args["kind"] == "post"
        record = scope.build(attributes)
        ctx.authorize!(record, :create)
        record.save!
        serialize(record)
      end
      plugin_types = BlockRenderer::REGISTRY.keys - ContentBlocks.types - %w[page_builder]
      blocks = ContentBlocks.blocks_schema(extra_types: plugin_types)
      add.call("content_save_draft", "content:write", "Save content blocks as the draft, preserving the live version. Each block's data is validated against its type (see inkwell.content_guide): use real table blocks for comparisons, takeaways near the top of long posts, faq near the end. Builder blocks must be edited through the Builder workspace tools. Requires current version.", object(content_keys.merge(version: { type: "string" }, blocks: blocks), %w[kind id version blocks])) do |ctx, args|
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
      text = ->(max) { { type: "string", maxLength: max } }
      metadata = {
        title: { type: "string", minLength: 1, maxLength: 200 },
        seo_title: text.call(300), seo_description: text.call(1000), seo_focus_keyword: text.call(300),
        og_title: text.call(300), og_description: text.call(1000), noindex: { type: "boolean" }, nofollow: { type: "boolean" },
        excerpt: { type: "string", maxLength: 400, description: "Post only. One or two sentences shown on cards and as the article dek." },
        slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", maxLength: 120, description: "Post only. Changing a published slug breaks old links." },
        featured_image_id: { type: %w[integer null], minimum: 1, description: "Post only. A media library image; null clears it." },
        featured_image_alt: text.call(500),
        og_image_url: text.call(2000), twitter_title: text.call(300), twitter_description: text.call(1000), twitter_image_url: text.call(2000),
        canonical_url_override: text.call(2000),
        schema_article_type: { type: "string", enum: %w[Article BlogPosting NewsArticle TechArticle] },
        cornerstone: { type: "boolean", description: "Post only. Featured/cornerstone story: themes promote it on the blog index." },
        categories: { type: "array", items: { type: "string", minLength: 1, maxLength: 80 }, maxItems: 3, description: "Post only. Category names (created if missing). The first is the primary category." },
        tags: { type: "array", items: { type: "string", minLength: 1, maxLength: 80 }, maxItems: 15, description: "Post only. Tag names (created if missing)." },
        author_id: { type: "integer", minimum: 1, description: "Post only. A user on this site (see inkwell.authors_list)." }
      }
      add.call("content_update_metadata", "content:write", "Update title, excerpt, slug, SEO/social fields, featured image, categories, tags, author and featured flag. These take effect immediately; published content also requires content:publish permission. Read current version first.", object(content_keys.merge(version: { type: "string" }, values: object(metadata)), %w[kind id version values])) do |ctx, args|
        record = ctx.record(args["kind"], args["id"])
        record.with_lock do
          ctx.authorize!(record, :update)
          ctx.check_version!(record, args["version"])
          if record.status == "published"
            ctx.require_scope!("content:publish")
            ctx.authorize!(record, :publish)
          end
          values = args["values"].dup
          post_only = %w[excerpt slug featured_image_id featured_image_alt og_image_url twitter_title twitter_description twitter_image_url canonical_url_override schema_article_type cornerstone categories tags author_id]
          raise Error, "#{(values.keys & post_only).join(', ')} can only be set on posts" if record.is_a?(Page) && (values.keys & post_only).any?
          categories = values.delete("categories")
          tags = values.delete("tags")
          if values.key?("author_id")
            author = ctx.site.users.active.find_by(id: values["author_id"])
            raise Error, "Choose an active user on this site (inkwell.authors_list)" unless author
          end
          if values["canonical_url_override"].present? && !values["canonical_url_override"].match?(%r{\Ahttps?://}i)
            raise Error, "canonical_url_override must be an absolute http(s) URL"
          end
          if values.key?("featured_image_id")
            raise Error, "Featured images can only be assigned to posts" unless record.is_a?(Post)
            if values["featured_image_id"]
              image = ctx.site.media_items.find_by(id: values["featured_image_id"])
              raise Error, "Choose an image from this site's media library" unless image&.image?
            end
          end
          record.update!(values)
          assign_terms!(ctx, record, "category", categories) unless categories.nil?
          assign_terms!(ctx, record, "tag", tags) unless tags.nil?
          record.touch if !categories.nil? || !tags.nil?
        end
        serialize(record, details: true)
      end
      add.call("content_publish", "content:publish", "Publish the current draft explicitly, or schedule a post with publish_at (ISO 8601, future). Requires current version. Review seo_checks from content_read first. Compiles no Builder HTML; save visual edits in the real Builder first.", object(content_keys.merge(version: { type: "string" }, publish_at: { type: "string", format: "date-time" }), %w[kind id version])) do |ctx, args|
        record = ctx.record(args["kind"], args["id"])
        record.with_lock do
          ctx.authorize!(record, :publish)
          ctx.check_version!(record, args["version"])
          if args["publish_at"].present?
            raise Error, "Only posts can be scheduled" unless record.is_a?(Post)
            at = Time.zone.parse(args["publish_at"]) rescue nil
            raise Error, "publish_at must be a future ISO 8601 time" unless at && at > Time.current
            raise Error, "Scheduling is for posts that are not live yet" if record.status == "published"
            ctx.activity.before_state = ctx.snapshot(record)
            record.update!(draft_content: record.draft_content || record.content_blocks, status: "scheduled", scheduled_for: at)
            ctx.activity.after_state = ctx.snapshot(record)
            next
          end
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
