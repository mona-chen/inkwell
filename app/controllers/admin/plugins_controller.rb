module Admin
  class PluginsController < BaseController
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
  end
end
