module Admin
  class MenuItemsController < BaseController
    before_action :set_menu

    def create
      item = @menu.menu_items.create!(resolved_params.merge(position: @menu.menu_items.count))
      redirect_to admin_menu_path(@menu), notice: "Navigation item added."
    end

    def update
      item = @menu.menu_items.find(params[:id])
      item.update!(resolved_params(item: item))
      respond_to do |format|
        format.json { head :ok }
        format.html { redirect_to admin_menu_path(@menu), notice: "Navigation item updated." }
      end
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
      params.require(:menu_item).permit(:label, :url, :position, :parent_id, :page_id)
    end

    def resolved_params(item: nil)
      attrs = menu_item_params.to_h.symbolize_keys
      page_id = attrs.delete(:page_id)
      parent_id = attrs.delete(:parent_id)

      if page_id.present?
        page = Current.site.pages.find(page_id)
        attrs[:linkable] = page
        attrs[:label] = page.title if attrs[:label].blank?
        attrs[:url] = nil
      elsif attrs[:url].present?
        attrs[:linkable] = nil
      end

      if parent_id.present?
        parent = @menu.menu_items.find(parent_id)
        attrs[:parent] = parent unless item && parent.id == item.id
      else
        attrs[:parent] = nil
      end
      attrs
    end
  end
end
