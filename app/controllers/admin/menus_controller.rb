module Admin
  class MenusController < BaseController
    LOCATIONS = %w[header footer].freeze

    def index
      @menus = LOCATIONS.map { |loc| Current.site.menus.find_or_create_by!(location: loc) { |m| m.name = loc.titleize } }
      render Admin::MenusPage.new(menus: @menus)
    end

    def show
      @menu = Current.site.menus.find(params[:id])
      render Admin::MenuPage.new(menu: @menu)
    end
  end
end
