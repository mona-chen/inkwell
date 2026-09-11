module Api
  class BaseController < ActionController::API
    before_action :set_current_site
    before_action :authenticate_api_token

    rescue_from ActiveRecord::RecordNotFound, with: :render_not_found

    private

    # Site resolution: the Multisite middleware sets the resolved id in the rack env (matched
    # by domain); otherwise fall back to the default site. This is what makes one API serve
    # every tenant from its own host.
    def set_current_site
      Current.site ||= begin
        if defined?(Multisite::SiteResolver)
          site_id = request.env["multisite.site_id"]
          Site.find_by(id: site_id) if site_id
        end
      end || Site.find_by(is_default: true) || Site.first
    end

    # Optional bearer token. A valid, active token unlocks drafts and unpublished content
    # and is recorded as "last used". Without one, the API serves published content only.
    def authenticate_api_token
      token = bearer_token
      return if token.blank?

      @api_token = Current.site&.api_tokens&.active&.find_by(token: token)
      @api_token&.touch_usage!
    end

    def bearer_token
      request.headers["Authorization"].to_s[/\ABearer\s+(.+)\z/i, 1]&.strip
    end

    def include_drafts?
      @api_token.present?
    end

    def base_url
      scheme = request.ssl? ? "https" : "http"
      "#{scheme}://#{Current.site&.domain}"
    end

    def serialize(serializer, record)
      serializer.call(record, include_drafts: include_drafts?, base_url: base_url)
    end

    def pagination_meta(scope)
      { total: scope.total_count, page: scope.current_page, per_page: scope.limit_value }
    end

    def render_jsonapi(data, meta: nil, status: :ok)
      render json: { data: data, meta: meta }.compact, status: status
    end

    def render_not_found
      render json: { errors: [ { title: "Not Found", status: "404" } ] }, status: :not_found
    end
  end
end
