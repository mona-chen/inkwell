module ThemeRuntimeHelper
  def inkwell_site
    theme_runtime_serializer.site_payload
  end

  def inkwell_navigation(location: "header")
    theme_runtime_serializer.navigation(location: location.to_s)
  end

  def inkwell_posts(limit: 10, query: "latest", page: 1, per_page: 10, author: nil, tag: nil, category: nil, search: nil)
    limit = limit.to_i.clamp(1, ThemeRuntime::Serializer::MAX_COLLECTION)
    collection = Current.site.posts.published.includes(:author).order(published_at: :desc)
    collection = collection.where(author: author) if author
    collection = collection.where("title ILIKE ?", "%#{search}%") if search.present?
    page_number = page.to_i.clamp(1, 10_000)
    page_size = per_page.to_i.clamp(1, ThemeRuntime::Serializer::MAX_COLLECTION)
    total = collection.count
    records = collection.offset((page_number - 1) * page_size).limit([ limit, page_size ].min)
    {
      "posts" => records.map { |post| theme_runtime_serializer.post_payload(post) },
      "pagination" => theme_runtime_serializer.pagination(page: page_number, per_page: page_size, total: total)
    }
  end

  def inkwell_post(post = nil)
    record = post || @post || @page
    record.is_a?(Post) || record.is_a?(Page) ? theme_runtime_serializer.page_payload(record) : (@theme_data&.dig("page") || {})
  end

  def inkwell_authors(limit: 20)
    theme_runtime_serializer.authors(limit: limit)
  end

  def inkwell_comments(post, limit: 50)
    theme_runtime_serializer.comments(post, limit: limit)
  end

  def inkwell_seo(record: nil, route: nil)
    theme_runtime_serializer.seo_payload(record: record, route: route, path: request.path)
  end

  def inkwell_data
    @theme_data || theme_runtime_serializer.document(path: request.path, record: @post || @page)
  end

  def theme_part(key)
    part = ThemeRuntime::Parts.new(site: Current.site, theme_slug: @current_theme || Current.site.active_theme).read(key)
    return "".html_safe unless part

    if part[:source] == "release" && theme_runtime_runtime&.manifest&.kind == "rails"
      begin
        render(partial: part[:declaration], layout: false)
      rescue ActionView::MissingTemplate
        render(template: part[:declaration], layout: false)
      end
    else
      part[:body].to_s.html_safe
    end
  rescue ActionView::MissingTemplate
    "".html_safe
  end

  private

  def theme_runtime_serializer
    @theme_runtime_serializer ||= ThemeRuntime::Serializer.new(site: Current.site, base_url: request.base_url)
  end

  def theme_runtime_runtime
    ThemePackages::Runtime.for(@current_theme || Current.site.active_theme)
  end
end
