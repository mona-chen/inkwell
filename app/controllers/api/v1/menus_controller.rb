module Api
  module V1
    class MenusController < Api::BaseController
      def index
        menus = Current.site.menus.order(:location)
        render_jsonapi(menus.map { |menu| serialize(Api::MenuSerializer, menu) })
      end

      def show
        menu = Current.site.menus.find_by!(location: params[:location])
        render_jsonapi serialize(Api::MenuSerializer, menu)
      end
    end
  end
end
