module AiWriter
  class VisualReviewsController < Admin::BaseController
    def create
      render json: VisualReviewClient.new(site: Current.site).review(
        image: params[:image], brief: params[:brief], viewport: params[:viewport]
      )
    rescue Client::Error, JSON::ParserError => error
      render json: { ok: false, visually_reviewed: false, error: error.message }, status: :unprocessable_entity
    end
  end
end
