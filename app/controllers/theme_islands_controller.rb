class ThemeIslandsController < ApplicationController
  KINDS = %w[comments search posts authors post pagination].freeze
  MAX_PER_PAGE = 50
  MAX_BYTES = 512.kilobytes

  skip_forgery_protection

  def show
    return head :not_found unless KINDS.include?(params[:kind].to_s)

    data = build_data
    return head :not_found unless data

    json = JSON.generate(data)
    return head :payload_too_large if json.bytesize > MAX_BYTES

    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    response.headers["Vary"] = "Accept"
    response.etag = Digest::SHA256.hexdigest([ Current.site.id, params[:kind], params.except(:controller, :action).to_unsafe_h.sort_by { |key, _| key }, etag_fingerprint ].to_json)
    return head :not_modified if request.fresh?(response)

    render body: json, content_type: "application/json"
  end

  private

  def serializer
    @serializer ||= ThemeRuntime::Serializer.new(site: Current.site, base_url: request.base_url)
  end

  def page_number
    [ params[:page].to_i, 1 ].max
  end

  def per_page
    value = params[:per_page].to_i
    value = 10 unless value.positive?
    value.clamp(1, MAX_PER_PAGE)
  end

  def build_data
    case params[:kind]
    when "comments" then comments_data
    when "search" then search_data
    when "posts" then posts_data
    when "authors" then authors_data
    when "post" then post_data
    when "pagination" then pagination_data
    end
  end

  def comments_data
    post = find_post
    return unless post

    comments = serializer.comments(post, limit: per_page)
    {
      site: serializer.site_payload,
      page: serializer.post_payload(post),
      comments: comments,
      pagination: serializer.pagination(page: 1, per_page: per_page, total: comments.size)
    }
  end

  def search_data
    query = params[:q].to_s.strip.first(200)
    scope = Current.site.posts.published
    scope = scope.where("posts.title ILIKE :term OR posts.excerpt ILIKE :term", term: "%#{query}%") if query.present?
    records, pagination = paginate(scope.order(published_at: :desc))
    {
      site: serializer.site_payload,
      posts: records.map { |post| serializer.post_payload(post) },
      pagination: serializer.pagination(page: page_number, per_page: per_page, total: scope.count)
    }
  end

  def posts_data
    scope = Current.site.posts.published
    scope = scope.where(author_id: params[:author_id]) if params[:author_id].present?
    if params[:tag].present?
      scope = scope.joins(:terms).where(terms: { slug: params[:tag].to_s.first(100), taxonomy: "tag" })
    end
    if params[:category].present?
      scope = scope.joins(:terms).where(terms: { slug: params[:category].to_s.first(100), taxonomy: "category" })
    end
    records, = paginate(scope.order(published_at: :desc))
    {
      site: serializer.site_payload,
      posts: records.map { |post| serializer.post_payload(post) },
      pagination: serializer.pagination(page: page_number, per_page: per_page, total: scope.count)
    }
  end

  def authors_data
    authors = serializer.authors(limit: per_page)
    { site: serializer.site_payload, authors: authors, pagination: serializer.pagination(page: 1, per_page: per_page, total: authors.size) }
  end

  def post_data
    post = find_post
    return unless post

    { site: serializer.site_payload, page: serializer.post_payload(post), comments: serializer.comments(post, limit: per_page) }
  end

  def pagination_data
    post = find_post if params[:post_id].present?
    data = { site: serializer.site_payload, pagination: serializer.pagination(page: page_number, per_page: per_page, total: params[:total].to_i) }
    data[:comments] = serializer.comments(post, limit: per_page) if post
    data
  end

  def find_post
    scope = Current.site.posts.published
    if params[:post_id].present?
      return unless params[:post_id].to_s.match?(/\A\d{1,20}\z/)
      scope.find_by(id: params[:post_id])
    elsif params[:slug].present?
      scope.friendly.find(params[:slug].to_s.first(200))
    end
  rescue ActiveRecord::RecordNotFound
    nil
  end

  def paginate(scope)
    total = scope.count
    records = scope.offset((page_number - 1) * per_page).limit(per_page).to_a
    [ records, serializer.pagination(page: page_number, per_page: per_page, total: total) ]
  end

  def etag_fingerprint
    case params[:kind]
    when "comments", "post"
      find_post&.updated_at&.to_f || 0
    when "authors"
      Current.site.users.active.maximum(:updated_at)&.to_f || 0
    else
      Current.site.posts.published.maximum(:updated_at)&.to_f || 0
    end
  end
end
