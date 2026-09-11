module Admin
  class PluginsController < BaseController
    before_action :require_super_admin!

    def index
      @plugins = InstalledPlugin.order(:name)
      render Admin::PluginsPage.new(plugins: @plugins)
    end

    def activate
      Inkwell::PluginManager.activate!(params[:id])
      redirect_to admin_plugins_path, notice: "Plugin activated."
    end

    def deactivate
      Inkwell::PluginManager.deactivate!(params[:id])
      redirect_to admin_plugins_path, notice: "Plugin deactivated."
    end

    private

    def require_super_admin!
      unless current_user.admin?
        redirect_to admin_root_path, alert: "Only platform admins can manage plugins."
      end
    end
  end
end
