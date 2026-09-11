module Api
  module V1
    class MediaController < Api::BaseController
      def index
        media = Current.site.media_items.order(created_at: :desc).page(params[:page]).per(params[:per_page] || 50)

        render_jsonapi(media.map { |item| serialize(Api::MediaSerializer, item) }, meta: pagination_meta(media))
      end
    end
  end
end
