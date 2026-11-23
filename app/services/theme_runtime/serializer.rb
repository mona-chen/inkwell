module ThemeRuntime
  # The single normalized public data contract shared by static themes, Rails
  # helpers, fixtures, islands, and the Builder preview. Every field is an
  # explicit allowlist entry: models, credentials and private settings never
  # reach a theme.
  class Serializer
    MAX_COLLECTION = 100

    attr_reader :site, :base_url

    # `paths` maps content roles to the active theme's URL patterns, e.g.
    # { "post" => "/blog/:slug", "author" => "/contributors/:slug", "blog" => "/blog" },
    # so every link and canonical URL in the contract points at the theme's routes.
    def initialize(site:, base_url: nil, paths: {})
      @site = site
      @base_url = base_url.presence || site.url
      @paths = (paths || {}).transform_keys(&:to_s).compact_blank
    end

    def post_path(post) = route_for("post", post.slug, post.url)
    def author_path(user) = route_for("author", user.to_param, "/authors/#{user.to_param}")
    def blog_path = @paths["blog"].presence || "/posts"

    def category_path(term)
      "#{blog_path}?category=#{CGI.escape(term.slug.to_s)}"
    end

    def tag_path(term)
      "#{blog_path}?tag=#{CGI.escape(term.slug.to_s)}"
    end

    def site_payload
      {
        "id" => site.id.to_s,
        "name" => site.name.to_s,
        "url" => absolute(site.url),
        "logo" => absolute(site.logo_item&.url.presence || site.logo_url)
      }.compact
    end

    def navigation(location: "header", current_path: nil)
      menu = site.menus.find_by(location: location)
      items = menu ? menu.menu_items.select { |item| item.parent_id.nil? }.map { |item| menu_item_payload(item, current_path) } : []
      assigned = ThemeRoute.active_for(site).published.where(navigation_location: location).ordered.filter_map do |route|
        next if route.path.include?(":")

        { "label" => route.navigation_label.presence || route.display_title, "url" => route.path, "active" => route.path == current_path, "children" => [] }
      end
      (items + assigned).uniq { |item| item["url"] }
    end

    def page_payload(record = nil, route: nil, path: nil)
      return theme_route_payload(route, path: path) if record.nil? && route

      if record.is_a?(Post) then post_payload(record)
      elsif record.is_a?(Page) then page_record_payload(record)
      elsif record.is_a?(User)
        {
          "type" => "author", "id" => record.id.to_s, "title" => record.name.to_s,
          "slug" => record.to_param.to_s, "url" => author_path(record),
          "html" => ERB::Util.html_escape(record.bio.to_s).gsub(/\r?\n/, "<br>"), "excerpt" => record.bio.to_s,
          "image" => absolute(record.avatar_display_url),
          "published_at" => nil, "updated_at" => record.updated_at&.utc&.iso8601,
          "author" => author_payload(record),
          "seo" => seo_payload(record: nil, route: route, path: path || author_path(record)).tap do |seo|
            seo["title"] ||= "#{record.name} — #{site.name}"
            seo["description"] ||= record.bio.to_s.truncate(160).presence
            seo["schema"] ||= person_schema(record)
          end
        }
      else
        {
          "type" => "page", "id" => nil, "title" => site.name.to_s, "slug" => "",
          "url" => "/", "html" => "", "excerpt" => site.setting("tagline", "").to_s,
          "published_at" => nil, "updated_at" => nil, "author" => {}, "seo" => seo_payload(record: nil, route: nil, path: path || "/")
        }
      end
    end

    # `full: false` is the lightweight card shape used in listings (no body HTML).
    def post_payload(post, full: true)
      document = ContentDocument.new(post.content_blocks)
      analysis = full ? ContentHtml.analyze(post.content_blocks) : { "html" => "", "toc" => [], "faq" => [] }
      categories = post.categories.order(:name).map { |term| term_payload(term) }
      payload = {
        "type" => "post",
        "id" => post.id.to_s,
        "title" => post.title.to_s,
        "slug" => post.slug.to_s,
        "image" => absolute(post.featured_image_url),
        "image_alt" => post.featured_image_alt.presence || post.featured_image&.alt_text.presence || "",
        "url" => post_path(post),
        "html" => analysis["html"],
        "excerpt" => post.excerpt.presence || document.text.truncate(300),
        "published_at" => post.published_at&.utc&.iso8601,
        "updated_at" => post.updated_at&.utc&.iso8601,
        "modified_at" => post.content_modified_at&.utc&.iso8601,
        "reading_time" => [ (document.words.size / 220.0).ceil, 1 ].max,
        "word_count" => document.words.size,
        "featured" => !!post.cornerstone,
        "category" => categories.first,
        "categories" => categories,
        "tags" => post.tags.order(:name).map { |term| term_payload(term) },
        "toc" => analysis["toc"],
        "author" => author_payload(post.author)
      }
      payload["seo"] = seo_payload(record: post, path: payload["url"]).merge("schema" => post_schema(post, payload, analysis["faq"])) if full
      payload
    end

    def term_payload(term)
      {
        "id" => term.id.to_s,
        "name" => term.name.to_s,
        "slug" => term.slug.to_s,
        "description" => term.try(:description).to_s,
        "url" => term.taxonomy == "tag" ? tag_path(term) : category_path(term)
      }
    end

    # Categories that have at least one published post, most-used first.
    def categories(limit: 20)
      counts = PostTerm.joins(:term).where(terms: { site_id: site.id, taxonomy: "category" }, termable_type: "Post", termable_id: site.posts.published.select(:id)).group(:term_id).count
      Term.where(id: counts.keys).sort_by { |term| [ -counts[term.id], term.name.to_s ] }.first(limit).map do |term|
        term_payload(term).merge("count" => counts[term.id])
      end
    end

    # Posts that share a category or tag with `post`, topped up with the latest posts.
    def related_posts(post, limit: 3)
      term_ids = post.post_terms.pluck(:term_id)
      scope = site.posts.published.where.not(id: post.id).includes(:author, :featured_image)
      related = term_ids.any? ? scope.joins(:post_terms).where(post_terms: { term_id: term_ids }).group("posts.id").order(Arel.sql("COUNT(post_terms.id) DESC, posts.published_at DESC")).limit(limit).to_a : []
      related += scope.where.not(id: related.map(&:id)).order(published_at: :desc).limit(limit - related.size).to_a if related.size < limit
      related.map { |record| post_payload(record, full: false) }
    end

    def page_record_payload(page)
      {
        "type" => "page",
        "id" => page.id.to_s,
        "title" => page.title.to_s,
        "slug" => page.slug.to_s,
        "url" => page.url,
        "html" => ContentHtml.render(page.content_blocks),
        "excerpt" => page.seo_description.presence || page.auto_meta_description.to_s,
        "published_at" => nil,
        "updated_at" => page.updated_at&.utc&.iso8601,
        "author" => author_payload(page.author),
        "seo" => seo_payload(record: page, path: page.url)
      }
    end

    def author_payload(user)
      return {} unless user
      {
        "id" => user.id.to_s,
        "name" => user.name.to_s,
        "slug" => user.to_param.to_s,
        "url" => author_path(user),
        "bio" => user.bio.to_s,
        "title" => user.job_title.to_s,
        "avatar" => absolute(user.avatar_display_url),
        "links" => user.profile_links.map { |link| link.slice("label", "url", "kind") },
        "posts_count" => user.posts.published.count
      }
    end

    def posts(limit: 10, query: "latest", page: 1, per_page: nil, author: nil, tag: nil, category: nil, search: nil, related_to: nil, full: false)
      scope = site.posts.published.includes(:author, :featured_image).order(published_at: :desc)
      scope = scope.where(author: author) if author
      scope = scope.where.not(id: related_to.id) if related_to.respond_to?(:id)
      scope = scope.joins(:terms).where(terms: { slug: tag, taxonomy: "tag" }) if tag.present?
      scope = scope.joins(:terms).where(terms: { slug: category, taxonomy: "category" }) if category.present?
      scope = scope.where("posts.title ILIKE :q OR posts.excerpt ILIKE :q", q: "%#{ActiveRecord::Base.sanitize_sql_like(search.to_s)}%") if search.present?
      size = (per_page || limit).to_i.clamp(1, MAX_COLLECTION)
      page = page.to_i.clamp(1, 10_000)
      total = scope.count if block_given?
      records = scope.order(id: :desc).offset((page - 1) * size).limit(size).map { |post| post_payload(post, full: full) }
      yield pagination(page: page, per_page: size, total: total) if block_given?
      records
    end

    def authors(limit: 20)
      site.users.active.order(:name).limit(limit.to_i.clamp(1, MAX_COLLECTION)).map { |user| author_payload(user) }
    end

    def comments(post, limit: 50)
      return [] unless post
      comments = post.comments.approved.includes(:user).order(:created_at).limit(limit.to_i.clamp(1, 100))
      comments.map { |comment| comment_payload(comment, post: post) }
    end

    def comment_payload(comment, post: nil)
      {
        "id" => comment.id.to_s,
        "post_id" => (post&.id || comment.post_id).to_s,
        "parent_id" => comment.parent_id&.to_s,
        "author" => {
          "name" => comment.author_name.to_s,
          "avatar" => comment.user ? nil : nil
        },
        "body" => comment.body.to_s,
        "html" => simple_html(comment.body),
        "created_at" => comment.created_at&.utc&.iso8601
      }
    end

    def pagination(collection = nil, page: 1, per_page: 10, total: nil)
      if collection.respond_to?(:current_page) && collection.respond_to?(:total_count)
        page = collection.current_page
        per_page = collection.limit_value
        total = collection.total_count
      else
        page = page.to_i.clamp(1, 10_000)
        per_page = per_page.to_i.clamp(1, MAX_COLLECTION)
        total = total.to_i
      end
      pages = per_page.to_i.positive? ? (total.to_f / per_page).ceil : 0
      {
        "page" => page.to_i,
        "per_page" => per_page.to_i,
        "total" => total.to_i,
        "pages" => pages,
        "next" => page.to_i < pages ? page.to_i + 1 : nil,
        "previous" => page.to_i > 1 ? page.to_i - 1 : nil
      }
    end

    def seo_payload(record: nil, route: nil, path: nil)
      route_seo = route&.seo_payload || {}
      record_seo = if record.respond_to?(:seo_title_display)
        {
          "title" => record.seo_title_display.to_s,
          "description" => record.seo_description_display.to_s,
          "canonical" => absolute(record.canonical_url),
          "robots" => record.noindex ? "noindex, nofollow" : "index, follow",
          "og" => { "title" => record.seo_og_title.to_s, "description" => record.seo_og_description.to_s, "image" => absolute(record.seo_og_image) },
          "twitter" => { "card" => "summary_large_image", "title" => record.seo_og_title.to_s, "description" => record.seo_og_description.to_s, "image" => absolute(record.seo_og_image) },
          "schema" => nil,
          "sitemap" => !(record.respond_to?(:noindex) && record.noindex)
        }
      else
        {}
      end
      title = route_seo["title"].presence || record_seo["title"].presence
      title ||= site.name.to_s if path.to_s == "/"
      description = route_seo["description"].presence || record_seo["description"].presence
      description ||= site.setting("tagline", "").to_s if path.to_s == "/"
      canonical = route_seo["canonical"].presence || record_seo["canonical"].presence || absolute(path || "/")
      {
        "title" => title,
        "description" => description,
        "canonical" => canonical,
        "robots" => route_seo["robots"].presence || record_seo["robots"].presence || "index, follow",
        "og" => {
          "title" => route_seo.dig("og", "title").presence || record_seo.dig("og", "title").presence || title,
          "description" => route_seo.dig("og", "description").presence || record_seo.dig("og", "description").presence || description,
          "image" => route_seo.dig("og", "image").presence || record_seo.dig("og", "image").presence
        }.compact,
        "twitter" => {
          "card" => route_seo.dig("twitter", "card").presence || record_seo.dig("twitter", "card").presence || "summary_large_image",
          "title" => route_seo.dig("twitter", "title").presence || record_seo.dig("og", "title").presence || title,
          "description" => route_seo.dig("twitter", "description").presence || record_seo.dig("og", "description").presence || description,
          "image" => route_seo.dig("twitter", "image").presence || record_seo.dig("og", "image").presence
        }.compact,
        "schema" => route_seo["schema"].presence || record_seo["schema"],
        "sitemap" => route_seo.fetch("sitemap", true) && record_seo.fetch("sitemap", true)
      }
    end

    def document(path:, route: nil, record: nil, navigation_location: "header", posts: nil, authors: nil, comments: nil, pagination: nil)
      page = page_payload(record, route: route, path: path)
      post = record.is_a?(Post) ? record : nil
      {
        "site" => site_payload,
        "navigation" => navigation(location: navigation_location, current_path: path),
        "page" => page,
        "posts" => posts || [],
        "authors" => authors || [],
        "comments" => comments || (post ? self.comments(post) : []),
        "pagination" => pagination || self.pagination(page: 1, per_page: 10, total: 0)
      }
    end

    def absolute_url(value)
      absolute(value)
    end

    private

    def route_for(role, slug, fallback)
      pattern = @paths[role].to_s
      pattern.end_with?("/:slug") ? pattern.sub(/:slug\z/, slug.to_s) : fallback
    end

    # BlogPosting + BreadcrumbList (+ FAQPage) as one JSON-LD graph.
    def post_schema(post, payload, faq)
      url = absolute(payload["url"])
      author = post.author
      graph = []
      article = {
        "@type" => post.schema_article_type.presence_in(%w[Article BlogPosting NewsArticle TechArticle]) || "BlogPosting",
        "@id" => "#{url}#article",
        "headline" => post.seo_title_display.to_s.truncate(110),
        "description" => post.seo_description_display.to_s,
        "url" => url,
        "mainEntityOfPage" => url,
        "datePublished" => payload["published_at"],
        "dateModified" => payload["modified_at"] || payload["updated_at"],
        "wordCount" => payload["word_count"],
        "inLanguage" => "en",
        "publisher" => { "@type" => "Organization", "name" => site.name.to_s, "url" => absolute(site.url), "logo" => (absolute(site.logo_item&.url.presence || site.logo_url) && { "@type" => "ImageObject", "url" => absolute(site.logo_item&.url.presence || site.logo_url) }) }.compact
      }
      article["image"] = [ absolute(post.seo_og_image) ].compact if post.seo_og_image.present?
      article["author"] = person_schema(author).except("@context") if author
      article["articleSection"] = payload.dig("category", "name") if payload["category"]
      article["keywords"] = payload["tags"].map { |tag| tag["name"] }.join(", ") if payload["tags"].any?
      graph << article.compact
      crumbs = [ [ site.name.to_s, absolute("/") ], [ "Blog", absolute(blog_path) ] ]
      crumbs << [ payload.dig("category", "name"), absolute(payload.dig("category", "url")) ] if payload["category"]
      crumbs << [ post.title.to_s, url ]
      graph << { "@type" => "BreadcrumbList", "itemListElement" => crumbs.each_with_index.map { |(name, item), index| { "@type" => "ListItem", "position" => index + 1, "name" => name, "item" => item } } }
      if faq.any?
        graph << { "@type" => "FAQPage", "mainEntity" => faq.map { |entry| { "@type" => "Question", "name" => entry["question"], "acceptedAnswer" => { "@type" => "Answer", "text" => entry["answer"] } } } }
      end
      { "@context" => "https://schema.org", "@graph" => graph }
    end

    def person_schema(user)
      {
        "@context" => "https://schema.org",
        "@type" => "Person",
        "name" => user.name.to_s,
        "url" => absolute(author_path(user)),
        "jobTitle" => user.job_title.presence,
        "description" => user.bio.presence,
        "image" => absolute(user.avatar_display_url),
        "sameAs" => user.profile_links.map { |link| link["url"] }.presence
      }.compact
    end

    def theme_route_payload(route, path: nil)
      {
        "type" => route.route_key.to_s.presence || "theme",
        "id" => route.id.to_s,
        "title" => route.display_title.to_s,
        "slug" => path.to_s.split("/").reject(&:blank?).last.to_s,
        "url" => path.presence || route.path,
        "html" => route.draft_data.dig("html").to_s,
        "excerpt" => route.meta_description.to_s,
        "published_at" => route.published_at&.utc&.iso8601,
        "updated_at" => route.updated_at&.utc&.iso8601,
        "author" => {},
        "seo" => seo_payload(route: route, path: path || route.path)
      }
    end

    def menu_item_payload(item, current_path = nil)
      url = item.resolved_url.to_s
      {
        "label" => item.label.to_s,
        "url" => url,
        "active" => url == current_path,
        "children" => item.children.order(:position).map { |child| menu_item_payload(child, current_path) }
      }
    end

    def absolute(url)
      value = url.to_s
      return if value.empty?
      return value if value.match?(%r{\A[a-z][a-z0-9+.-]*:}i) || value.start_with?("//")
      "#{base_url.to_s.sub(%r{/+\z}, '')}#{value.start_with?('/') ? value : "/#{value}"}"
    end

    def simple_html(body)
      ERB::Util.html_escape(body.to_s).gsub(/\r?\n/, "<br>")
    end
  end
end
