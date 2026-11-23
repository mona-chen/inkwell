module ThemeRuntime
  # Renders only the declarative regions allowed by the contract. Unknown region
  # names remain ordinary HTML; malformed known regions are left untouched
  # instead of turning theme markup into a code path.
  class Regions
    QUERIES = %w[latest featured popular related category tag search author].freeze

    def initialize(data:, serializer:)
      @data = data
      @serializer = serializer
    end

    def render!(document)
      document.css("[data-inkwell-region]").each do |node|
        region = node["data-inkwell-region"].to_s
        next unless ThemePackages::Manifest::REGION_TYPES.include?(region)
        next unless valid_attributes?(node, region)

        html = render_region(region, node)
        next if html.nil?

        node.inner_html = html
        node["data-inkwell-rendered"] = region
      end
      document
    end

    private

    def valid_attributes?(node, region)
      limit = node["data-inkwell-limit"]
      return false if limit.present? && !(limit.match?(/\A\d{1,3}\z/) && limit.to_i.between?(1, 100))
      query = node["data-inkwell-query"]
      return false if query.present? && !QUERIES.include?(query)
      page = node["data-inkwell-page"]
      return false if page.present? && !(page.match?(/\A\d{1,5}\z/) && page.to_i.positive?)
      id = node["data-inkwell-post"].to_s
      return false if id.present? && !id.match?(/\A\d{1,20}\z/)
      layout = node["data-inkwell-layout"]
      return false if layout.present? && !%w[grid feature list].include?(layout)
      true
    end

    def limit(node, fallback)
      node["data-inkwell-limit"].presence&.to_i || fallback
    end

    def render_region(region, node)
      case region
      when "site" then site_html
      when "navigation" then navigation_html
      when "posts" then posts_html(node)
      when "post" then post_html
      when "authors" then authors_html(node)
      when "author" then author_html
      when "comments" then comments_html(node)
      when "search" then search_html
      when "pagination" then pagination_html
      when "seo" then seo_html
      when "categories" then categories_html
      when "related" then related_html(node)
      when "toc" then toc_html
      end
    end

    def site_html
      site = @data["site"] || {}
      parts = []
      parts << %(<a class="ink-site-brand" href="/">#{h(site['name'])}</a>) if site["name"].present?
      if site["logo"].present?
        parts.unshift(%(<img class="ink-site-logo" src="#{h(site['logo'])}" alt="#{h(site['name'])}" loading="lazy">))
      end
      parts.join
    end

    def navigation_html
      items = Array(@data["navigation"])
      return %(<nav class="ink-navigation" aria-label="Primary"></nav>) if items.empty?

      list = items.map { |item| navigation_item(item) }.join
      %(<nav class="ink-navigation" aria-label="Primary"><ul>#{list}</ul></nav>)
    end

    def navigation_item(item)
      children = Array(item["children"])
      nested = children.empty? ? "" : "<ul>#{children.map { |child| navigation_item(child) }.join}</ul>"
      current = item["active"] ? %( aria-current="page") : ""
      %(<li><a href="#{h(item['url'])}"#{current}>#{h(item['label'])}</a>#{nested}</li>)
    end

    def posts_html(node)
      posts = Array(@data["posts"]).first(limit(node, 12))
      if posts.empty?
        filtered = (@data["filter"] || {}).values.any?(&:present?)
        message = filtered ? "No stories match this filter yet." : "No posts yet."
        reset = filtered ? %( <a href="#{h(blog_url)}">See all stories</a>) : ""
        return %(<div class="ink-region-empty"><p>#{message}#{reset}</p></div>)
      end

      level = heading_level(node)
      featured = node["data-inkwell-layout"] == "feature" && first_page? && !filtered?
      # A post marked featured (cornerstone) takes the hero slot even if it isn't the newest.
      if featured && (pick = posts.index { |post| post["featured"] })&.positive?
        posts = [ posts[pick] ] + posts.reject.with_index { |_, index| index == pick }
      end
      cards = posts.each_with_index.map { |post, index| post_card(post, level: level, featured: featured && index.zero?, eager: index < 2) }
      %(<div class="ink-region-posts#{featured ? ' ink-region-posts--feature' : ''}">#{cards.join}</div>)
    end

    def post_card(post, level: 2, featured: false, eager: false)
      url = h(post["url"])
      image = post["image"].presence
      media = if image
        %(<a class="ink-post-card__media" href="#{url}" tabindex="-1" aria-hidden="true"><img src="#{h(image)}" alt="" loading="#{eager ? 'eager' : 'lazy'}" decoding="async"></a>)
      else
        %(<a class="ink-post-card__media ink-post-card__media--placeholder" href="#{url}" tabindex="-1" aria-hidden="true"><span>#{h(post.dig('category', 'name').presence || post['title'].to_s.split.first(3).join(' '))}</span></a>)
      end
      category = post["category"].is_a?(Hash) && post.dig("category", "name").present? ? %(<p class="ink-post-card__eyebrow"><a class="ink-chip" href="#{h(post.dig('category', 'url'))}">#{h(post.dig('category', 'name'))}</a></p>) : ""
      excerpt = post["excerpt"].presence
      klass = featured ? "ink-post-card ink-post-card--featured" : "ink-post-card"
      %(<article class="#{klass}">#{media}<div class="ink-post-summary ink-post-card__body">#{category}<h#{level} class="ink-post-card__title"><a href="#{url}">#{h(post['title'])}</a></h#{level}>#{excerpt ? %(<p class="ink-post-card__excerpt">#{h(excerpt.truncate(featured ? 240 : 160))}</p>) : ''}#{post_byline(post)}</div></article>)
    end

    def post_html
      page = @data["page"] || {}
      return %(<p>No post selected.</p>) if page["title"].blank?

      toc = Array(page["toc"])
      cover = if page["image"].present?
        %(<figure class="ink-article__cover"><img class="ink-post-cover" src="#{h(page['image'])}" alt="#{h(page['image_alt'])}" fetchpriority="high" decoding="async"></figure>)
      else
        ""
      end
      aside = toc.size >= 2 ? %(<aside class="ink-article__aside">#{toc_nav(toc)}</aside>) : %(<aside class="ink-article__aside ink-article__aside--empty"></aside>)
      %(<article class="ink-region-post ink-article">#{article_header(page)}#{cover}<div class="ink-article__layout">#{aside}<div class="ink-article__main"><div class="ink-post-content ink-prose">#{page['html']}</div>#{article_footer(page)}</div></div></article>)
    end

    def article_header(page)
      crumbs = [ %(<li><a href="#{h(blog_url)}">Blog</a></li>) ]
      crumbs << %(<li><a href="#{h(page.dig('category', 'url'))}">#{h(page.dig('category', 'name'))}</a></li>) if page.dig("category", "name").present?
      dek = page["excerpt"].present? ? %(<p class="ink-article__dek">#{h(page['excerpt'])}</p>) : ""
      %(<header class="ink-article__header"><nav class="ink-breadcrumbs" aria-label="Breadcrumb"><ol>#{crumbs.join}</ol></nav><h1 class="ink-article__title">#{h(page['title'])}</h1>#{dek}#{article_meta(page)}</header>)
    end

    def article_meta(page)
      author = page["author"] || {}
      facts = []
      facts << %(<div><dt>Published</dt><dd>#{time_tag(page['published_at'])}</dd></div>) if page["published_at"].present?
      modified = page["modified_at"].presence
      if modified && page["published_at"].present? && modified.to_s.first(10) > page["published_at"].to_s.first(10)
        facts << %(<div><dt>Updated</dt><dd>#{time_tag(modified)}</dd></div>)
      end
      facts << %(<div><dt>Reading time</dt><dd>#{page['reading_time'].to_i} min read</dd></div>) if page["reading_time"].to_i.positive?
      who = if author["name"].present?
        role = author["title"].present? ? %(<span class="ink-article__author-role">#{h(author['title'])}</span>) : ""
        %(<div class="ink-article__author">#{avatar(author, 40)}<div><span class="ink-article__label">Written by</span><a class="ink-article__author-name" href="#{h(author['url'])}">#{h(author['name'])}</a>#{role}</div></div>)
      else
        ""
      end
      %(<div class="ink-article__meta">#{who}<dl class="ink-article__facts">#{facts.join}</dl>#{share_links(page)}</div>)
    end

    def article_footer(page)
      tags = Array(page["tags"])
      tag_list = tags.any? ? %(<ul class="ink-tags" aria-label="Tags">#{tags.map { |tag| %(<li><a class="ink-chip" href="#{h(tag['url'])}">#{h(tag['name'])}</a></li>) }.join}</ul>) : ""
      author = page["author"] || {}
      card = author["name"].present? ? %(<section class="ink-author-box" aria-label="About the author">#{avatar(author, 64)}<div><p class="ink-article__label">Written by</p><p class="ink-author-box__name"><a href="#{h(author['url'])}">#{h(author['name'])}</a></p>#{author['title'].present? ? %(<p class="ink-author-box__role">#{h(author['title'])}</p>) : ''}#{author['bio'].present? ? %(<p class="ink-author-box__bio">#{h(author['bio'])}</p>) : ''}#{profile_links(author)}</div></section>) : ""
      %(<footer class="ink-article__footer">#{tag_list}#{card}</footer>)
    end

    def share_links(page)
      url = @serializer ? @serializer.absolute_url(page["url"]) : page["url"]
      return "" if url.blank?

      title = page["title"].to_s
      encoded_url = CGI.escape(url.to_s)
      encoded_title = CGI.escape(title)
      targets = [
        [ "x", "Share on X", "https://twitter.com/intent/tweet?url=#{encoded_url}&text=#{encoded_title}" ],
        [ "linkedin", "Share on LinkedIn", "https://www.linkedin.com/sharing/share-offsite/?url=#{encoded_url}" ],
        [ "whatsapp", "Share on WhatsApp", "https://wa.me/?text=#{CGI.escape("#{title} #{url}")}" ],
        [ "facebook", "Share on Facebook", "https://www.facebook.com/sharer/sharer.php?u=#{encoded_url}" ]
      ]
      links = targets.map { |kind, label, href| %(<li><a class="ink-share__link ink-share__link--#{kind}" href="#{h(href)}" target="_blank" rel="noopener" aria-label="#{label}" title="#{label}"></a></li>) }
      links << %(<li><button type="button" class="ink-share__link ink-share__link--copy" data-ink-copy="#{h(url)}" aria-label="Copy link" title="Copy link"></button></li>)
      %(<ul class="ink-share" aria-label="Share this article">#{links.join}</ul>)
    end

    def toc_nav(toc)
      items = toc.map { |entry| %(<li class="ink-toc__item ink-toc__item--h#{entry['level'].to_i}"><a href="##{h(entry['id'])}">#{h(entry['text'])}</a></li>) }.join
      %(<nav class="ink-toc" aria-label="On this page"><p class="ink-toc__title">On this page</p><ol>#{items}</ol></nav>)
    end

    def toc_html
      toc = Array(@data.dig("page", "toc"))
      toc.empty? ? "" : toc_nav(toc)
    end

    def categories_html
      categories = Array(@data["categories"])
      current = @data.dig("filter", "category")
      all = %(<li><a class="ink-categories__link" href="#{h(blog_url)}"#{current.blank? && @data.dig('filter', 'tag').blank? ? ' aria-current="page"' : ''}>All</a></li>)
      items = categories.map do |term|
        active = term["slug"].to_s == current.to_s ? ' aria-current="page"' : ""
        %(<li><a class="ink-categories__link" href="#{h(term['url'])}"#{active}>#{h(term['name'])}</a></li>)
      end
      %(<nav class="ink-categories" aria-label="Categories"><ul>#{all}#{items.join}</ul></nav>)
    end

    def related_html(node)
      posts = Array(@data["related"]).first(limit(node, 3))
      return "" if posts.empty?

      %(<div class="ink-region-posts ink-region-related">#{posts.map { |post| post_card(post, level: heading_level(node, 3)) }.join}</div>)
    end

    def post_byline(post)
      author = post["author"] || {}
      date = post["published_at"].present? ? time_tag(post["published_at"]) : nil
      return "" if author["name"].blank? && date.nil?

      reading = post["reading_time"].to_i.positive? ? %(<span class="ink-post-meta__reading">#{post['reading_time'].to_i} min read</span>) : ""
      name = author["name"].present? ? %(<span class="ink-post-meta__author">#{h(author['name'])}</span>) : ""
      sep = name.present? && date ? %(<span class="ink-post-meta__sep" aria-hidden="true">·</span>) : ""
      %(<p class="ink-post-meta">#{author['name'].present? ? avatar(author, 28, klass: 'ink-byline-avatar') : ''}#{name}#{sep}#{date}#{reading}</p>)
    end

    def avatar(author, size, klass: "ink-avatar")
      if author["avatar"].present?
        %(<img class="#{klass}" src="#{h(author['avatar'])}" alt="" width="#{size}" height="#{size}" loading="lazy">)
      else
        initials = author["name"].to_s.split.first(2).map { |part| part[0] }.join.upcase
        %(<span class="#{klass} ink-avatar-placeholder" style="--ink-avatar-size:#{size}px" aria-hidden="true">#{h(initials)}</span>)
      end
    end

    def profile_links(author)
      links = Array(author["links"]).select { |link| link["url"].to_s.match?(%r{\A(?:https?://|mailto:)}i) }
      return "" if links.empty?

      %(<ul class="ink-profile-links">#{links.map { |link| %(<li><a class="ink-profile-links__link ink-profile-links__link--#{h(link['kind'])}" href="#{h(link['url'])}" rel="noopener me">#{h(link['label'])}</a></li>) }.join}</ul>)
    end

    def time_tag(value)
      date = Date.iso8601(value.to_s.first(10))
      %(<time datetime="#{h(value)}">#{date.strftime('%b %-d, %Y')}</time>)
    rescue Date::Error
      nil
    end

    def heading_level(node, fallback = 2)
      value = node["data-inkwell-heading"].to_s
      value.match?(/\A[2-4]\z/) ? value.to_i : fallback
    end

    def first_page?
      (@data.dig("pagination", "page") || 1).to_i <= 1
    end

    def filtered?
      (@data["filter"] || {}).values.any?(&:present?)
    end

    def blog_url
      @serializer&.blog_path || "/posts"
    end

    def authors_html(node)
      authors = Array(@data["authors"]).first(limit(node, 12))
      return %(<div class="ink-region-empty"><p>No authors yet.</p></div>) if authors.empty?

      %(<div class="ink-region-authors">#{authors.map { |author| author_card(author) }.join}</div>)
    end

    def author_card(author)
      role = author["title"].present? ? %(<p class="ink-author-card__role">#{h(author['title'])}</p>) : ""
      %(<article class="ink-author-card">#{avatar(author, 56)}<h2><a href="#{h(author['url'])}">#{h(author['name'])}</a></h2>#{role}#{author['bio'].present? ? "<p>#{h(author['bio'])}</p>" : ''}</article>)
    end

    def author_html
      author = @data["page"].is_a?(Hash) ? @data["page"]["author"] : nil
      author ||= Array(@data["authors"]).first
      return %(<p>No author selected.</p>) if author.blank? || author["name"].blank?

      count = author["posts_count"].to_i
      stories = count.positive? ? %(<p class="ink-author-profile__count">#{count} #{count == 1 ? 'story' : 'stories'}</p>) : ""
      role = author["title"].present? ? %(<p class="ink-author-profile__role">#{h(author['title'])}</p>) : ""
      bio = author["bio"].present? ? %(<p class="ink-author-profile__bio">#{h(author['bio'])}</p>) : ""
      %(<div class="ink-region-author"><header class="ink-author-profile">#{avatar(author, 96)}<div><p class="ink-article__label">Contributor</p><h1 class="ink-author-profile__name">#{h(author['name'])}</h1>#{role}#{bio}#{profile_links(author)}#{stories}</div></header></div>)
    end

    def comments_html(node)
      comments = Array(@data["comments"]).first(limit(node, 50))
      return %(<div class="ink-region-empty"><p>No comments yet.</p></div>) if comments.empty?

      list = comments.map do |comment|
        %(<li class="ink-comment"><p class="ink-comment-author">#{h(comment.dig('author', 'name'))}</p><div class="ink-comment-body">#{comment['html']}</div></li>)
      end.join
      %(<ol class="ink-region-comments">#{list}</ol>)
    end

    def search_html
      %(<form class="ink-search" role="search" action="/posts" method="get"><label class="ink-visually-hidden" for="ink-search-q">Search</label><input id="ink-search-q" type="search" name="q" placeholder="Search posts"><button type="submit">Search</button></form>)
    end

    def seo_html
      seo = @data.dig("page", "seo") || {}
      tags = []
      tags << %(<title>#{h(seo['title'])}</title>) if seo["title"].present?
      tags << %(<meta name="description" content="#{h(seo['description'])}">) if seo["description"].present?
      tags << %(<meta name="robots" content="#{h(seo['robots'])}">) if seo["robots"].present?
      tags << %(<link rel="canonical" href="#{h(seo['canonical'])}">) if seo["canonical"].present?
      tags << %(<meta property="og:image" content="#{h(seo.dig('og', 'image'))}">) if seo.dig("og", "image").present?
      tags.join
    end

    def pagination_html
      pagination = @data["pagination"] || {}
      return "" if pagination["pages"].to_i <= 1

      filters = (@data["filter"] || {}).compact_blank
      href = ->(page) { "?#{filters.merge('page' => page).to_query}" }
      previous = pagination["previous"] ? %(<a rel="prev" href="#{h(href.call(pagination['previous']))}">Previous</a>) : %(<span aria-disabled="true">Previous</span>)
      following = pagination["next"] ? %(<a rel="next" href="#{h(href.call(pagination['next']))}">Next</a>) : %(<span aria-disabled="true">Next</span>)
      %(<nav class="ink-pagination" aria-label="Pagination">#{previous}<span>Page #{pagination['page']} of #{pagination['pages']}</span>#{following}</nav>)
    end

    def h(value)
      ERB::Util.html_escape(value.to_s)
    end
  end
end
