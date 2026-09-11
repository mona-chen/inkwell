module Api
  module V1
    class PagesController < Api::BaseController
      def index
        pages = base_scope.order(:menu_order, :title).page(params[:page]).per(params[:per_page] || 50)

        render_jsonapi(pages.map { |page| serialize(Api::PageSerializer, page) }, meta: pagination_meta(pages))
      end

      def show
        page = base_scope.friendly.find(params[:id])
        render_jsonapi serialize(Api::PageSerializer, page)
      end

      private

      def base_scope
        include_drafts? ? Current.site.pages : Current.site.pages.published
      end
    end
  end
end
