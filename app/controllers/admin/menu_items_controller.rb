module Admin
  class MenuItemsController < BaseController
    before_action :set_menu

    def create
      item = @menu.menu_items.create!(menu_item_params.merge(position: @menu.menu_items.count))
      redirect_to admin_menu_path(@menu)
    end

    def update
      item = @menu.menu_items.find(params[:id])
      item.update!(menu_item_params)
      head :ok
    end

    def destroy
      @menu.menu_items.find(params[:id]).destroy
      redirect_to admin_menu_path(@menu)
    end

    private

    def set_menu
      @menu = Current.site.menus.find(params[:menu_id])
    end

    def menu_item_params
      params.require(:menu_item).permit(:label, :url, :position, :parent_id)
    end
  end
end
