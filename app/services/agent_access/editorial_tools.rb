module AgentAccess
  # Editorial tools for writing agents: the block/editorial guide, taxonomy, authors and
  # author profiles. Everything is scoped to the credential's site.
  module EditorialTools
    module_function

    GUIDE = {
      workflow: [
        "1. inkwell.content_guide (this) → inkwell.terms_list → inkwell.authors_list.",
        "2. Upload images with inkwell.media_upload (always pass alt text).",
        "3. inkwell.content_create (kind post, title, slug, excerpt).",
        "4. inkwell.content_save_draft with the full block array.",
        "5. inkwell.content_update_metadata: seo_title, seo_description, featured_image_id + featured_image_alt, categories, tags, cornerstone.",
        "6. inkwell.content_read → fix every failing seo_checks item → inkwell.content_publish (or schedule with publish_at)."
      ],
      structure: [
        "Open with a 2–3 sentence hook paragraph, then a `takeaways` block for posts over ~1,200 words.",
        "Use `heading` level 2 for sections and level 3 for subsections; never level 1 (the title is the h1). Headings build the table of contents.",
        "Keep paragraphs to 1–4 sentences. Prefer several `rich_text`/`paragraph` blocks over one huge document.",
        "Comparisons, pricing and specs go in a real `table` block (never an image of a table). Use `highlight` for your own product's column and a `note` with sources and the date checked.",
        "Use `stats` for headline numbers, `pros_cons` for 'choose X if / choose Y if', `callout` (tip/warning) for asides, `quote` style 'pull' for a standout quote.",
        "Use at most one or two `cta` blocks — typically one mid-article and one at the end.",
        "End long posts with a `faq` block of 3–6 real questions; it also produces FAQPage structured data.",
        "Images: meaningful alt text, a caption when it adds context, size 'wide' for screenshots."
      ],
      seo: [
        "seo_title 30–65 characters, front-load the primary keyword; seo_description 70–165 characters.",
        "excerpt: 1–2 sentences written for humans — it is the card summary and the article dek.",
        "One primary category (first in the list) and 2–6 specific tags.",
        "Link to 2+ relevant internal pages and cite external sources inline with [label](url).",
        "Mark evergreen pillar pieces with cornerstone: true so the theme features them."
      ],
      inline_formatting: ContentBlocks::INLINE
    }.freeze

    def object(properties = {}, required = [])
      { type: "object", properties: properties, required: required, additionalProperties: false }
    end

    def author_json(user)
      { id: user.id, name: user.name, job_title: user.job_title, bio: user.bio, avatar_url: user.avatar_display_url, avatar_media_id: user.avatar_item_id, links: user.profile_links, published_posts: user.posts.published.count }
    end

    def tools
      definitions = []
      add = ->(name, scope, description, schema, read_only = false, &handler) do
        definitions << Inkwell::Mcp::Tool.new(name: "inkwell.#{name}", scope: scope, description: description, schema: schema, read_only: read_only, &handler)
      end

      add.call("content_guide", "site:read", "Read this first when writing. Returns every content block type with its exact data shape and an example, plus the editorial workflow, structure and SEO standards for publishing excellent articles.", object, true) do |_ctx, _args|
        { blocks: ContentBlocks.guide, editorial: GUIDE }
      end

      add.call("terms_list", "site:read", "List categories and tags with published post counts. Reuse existing terms before creating new ones.", object, true) do |ctx, _args|
        counts = PostTerm.where(termable_type: "Post").group(:term_id).count
        terms = ctx.site.terms.where(taxonomy: %w[category tag]).order(:name)
        grouped = terms.group_by(&:taxonomy)
        {
          categories: Array(grouped["category"]).map { |term| { id: term.id, name: term.name, slug: term.slug, description: term.description, posts: counts[term.id].to_i } },
          tags: Array(grouped["tag"]).map { |term| { id: term.id, name: term.name, slug: term.slug, posts: counts[term.id].to_i } }
        }
      end

      add.call("term_upsert", "content:write", "Create or update a category or tag (matched by slug). Category descriptions appear on category listings.", object({
        taxonomy: { type: "string", enum: %w[category tag] },
        name: { type: "string", minLength: 1, maxLength: 80 },
        description: { type: "string", maxLength: 500 }
      }, %w[taxonomy name])) do |ctx, args|
        slug = args["name"].parameterize
        raise Error, "Invalid name" if slug.blank?
        term = ctx.site.terms.find_or_initialize_by(taxonomy: args["taxonomy"], slug: slug)
        term.name = args["name"]
        term.description = args["description"] if args.key?("description")
        term.save!
        { id: term.id, taxonomy: term.taxonomy, name: term.name, slug: term.slug, description: term.description }
      end

      add.call("authors_list", "site:read", "List active authors on this site with their public profiles.", object, true) do |ctx, _args|
        { authors: ctx.site.users.active.order(:name).map { |user| author_json(user) }, you: ctx.user.id }
      end

      add.call("profile_update", "content:write", "Update an author's public profile: name, job_title, bio, avatar (avatar_media_id from inkwell.media_upload, or null), and links ([{ label, url }]). Without user_id it updates the credential's own account; editing someone else requires an admin credential.", object({
        user_id: { type: "integer", minimum: 1 },
        name: { type: "string", minLength: 1, maxLength: 120 },
        job_title: { type: "string", maxLength: 120 },
        bio: { type: "string", maxLength: 2000 },
        avatar_media_id: { type: %w[integer null], minimum: 1 },
        links: { type: "array", maxItems: User::MAX_PROFILE_LINKS, items: object({ label: { type: "string", maxLength: 60 }, url: { type: "string", minLength: 3, maxLength: 500 }, kind: { type: "string", enum: User::PROFILE_LINK_KINDS } }, %w[url]) }
      })) do |ctx, args|
        user = args["user_id"] ? ctx.site.users.find_by(id: args["user_id"]) : ctx.user
        raise Error, "User not found on this site" unless user
        raise Error, "Only an admin credential can edit another user's profile" if user != ctx.user && !ctx.user.admin?
        attributes = args.slice("name", "job_title", "bio")
        attributes["profile_links"] = args["links"] if args.key?("links")
        if args.key?("avatar_media_id")
          if args["avatar_media_id"]
            image = ctx.site.media_items.find_by(id: args["avatar_media_id"])
            raise Error, "Choose an image from this site's media library" unless image&.image?
          end
          attributes["avatar_item_id"] = args["avatar_media_id"]
        end
        user.update!(attributes)
        author_json(user)
      end

      definitions
    end
  end
end
