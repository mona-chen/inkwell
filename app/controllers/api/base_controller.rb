module Api
  class BaseController < ActionController::API
    before_action :set_current_site

    rescue_from ActiveRecord::RecordNotFound, with: :render_not_found

    private

    def set_current_site
      Current.site = Site.first
    end

    def render_jsonapi(data, meta: nil, status: :ok)
      render json: { data: data, meta: meta }.compact, status: status
    end

    def render_not_found
      render json: { errors: [{ title: "Not Found", status: "404" }] }, status: :not_found
    end
  end
end
