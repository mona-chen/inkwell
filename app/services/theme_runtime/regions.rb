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
      posts = Array(@data["posts"]).first(limit(node, 6))
      if posts.empty?
        return %(<div class="ink-region-empty"><p>No posts yet.</p></div>)
      end

      cards = posts.map { |post| post_card(post) }.join
      %(<div class="ink-region-posts">#{cards}</div>)
    end

    def post_card(post)
      image = post["image"].presence
      media = image ? %(<a href="#{h(post['url'])}"><img src="#{h(image)}" alt="" loading="lazy"></a>) : ""
      author = post.dig("author", "name")
      meta = [ author, post["published_at"] ].compact.join(" · ")
      excerpt = post["excerpt"].presence
      %(<article class="ink-post-card">#{media}<h2><a href="#{h(post['url'])}">#{h(post['title'])}</a></h2>#{meta.present? ? "<p class=\"ink-post-meta\">#{h(meta)}</p>" : ''}#{excerpt ? "<p>#{h(excerpt)}</p>" : ''}</article>)
    end

    def post_html
      page = @data["page"] || {}
      return %(<p>No post selected.</p>) if page["title"].blank?

      author = page.dig("author", "name")
      meta = [ author, page["published_at"] ].compact.join(" · ")
      %(<article class="ink-region-post"><header><h1>#{h(page['title'])}</h1>#{meta.present? ? "<p class=\"ink-post-meta\">#{h(meta)}</p>" : ''}</header><div class="ink-post-content">#{page['html']}</div></article>)
    end

    def authors_html(node)
      authors = Array(@data["authors"]).first(limit(node, 12))
      return %(<div class="ink-region-empty"><p>No authors yet.</p></div>) if authors.empty?

      %(<div class="ink-region-authors">#{authors.map { |author| author_card(author) }.join}</div>)
    end

    def author_card(author)
      avatar = author["avatar"].present? ? %(<img class="ink-avatar" src="#{h(author['avatar'])}" alt="" loading="lazy">) : %(<span class="ink-avatar ink-avatar-placeholder">#{h(author['name'].to_s[0])}</span>)
      %(<article class="ink-author-card">#{avatar}<h2><a href="#{h(author['url'])}">#{h(author['name'])}</a></h2>#{author['bio'].present? ? "<p>#{h(author['bio'])}</p>" : ''}</article>)
    end

    def author_html
      author = @data["page"].is_a?(Hash) ? @data["page"]["author"] : nil
      author ||= Array(@data["authors"]).first
      return %(<p>No author selected.</p>) if author.blank?

      %(<div class="ink-region-author">#{author_card(author)}</div>)
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

      previous = pagination["previous"] ? %(<a rel="prev" href="?page=#{pagination['previous']}">Previous</a>) : %(<span aria-disabled="true">Previous</span>)
      following = pagination["next"] ? %(<a rel="next" href="?page=#{pagination['next']}">Next</a>) : %(<span aria-disabled="true">Next</span>)
      %(<nav class="ink-pagination" aria-label="Pagination">#{previous}<span>Page #{pagination['page']} of #{pagination['pages']}</span>#{following}</nav>)
    end

    def h(value)
      ERB::Util.html_escape(value.to_s)
    end
  end
end
