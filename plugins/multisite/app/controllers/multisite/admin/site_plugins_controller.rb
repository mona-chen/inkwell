module Multisite
  module Admin
    class SitePluginsController < BaseController
      before_action :find_site

      def index
        @plugins = InstalledPlugin.order(:name)
        @activations = @site.plugin_activations.index_by(&:installed_plugin_id)
        @mode = Multisite::PluginGate.global_mode?(@site) ? "global" : "per_site"
        render Multisite::Admin::SitePluginsPage.new(
          site: @site,
          plugins: @plugins,
          activations: @activations,
          mode: @mode
        )
      end

      # The multisite creator picks how plugin activation is decided for this site:
      #   "per_site" — plugins run only when toggled on for this site (default)
      #   "global"   — the global InstalledPlugin.active? flag alone decides
      def set_mode
        mode = params[:mode] == "global" ? "global" : "per_site"
        settings = @site.settings.merge(Multisite::PluginGate::MODE_KEY => mode)
        @site.update!(settings: settings)
        redirect_to multisite_routes.admin_site_plugins_path(@site), notice: "Plugin mode set to #{mode.tr('_', '-')}."
      end

      def activate
        record = InstalledPlugin.find_by!(slug: params[:id])
        activation = @site.plugin_activations.find_or_initialize_by(installed_plugin_id: record.id)
        activation.active = true
        activation.save!
        redirect_to multisite_routes.admin_site_plugins_path(@site), notice: "Plugin activated for #{@site.name}."
      rescue ActiveRecord::RecordNotUnique
        retry
      end

      def deactivate
        record = InstalledPlugin.find_by!(slug: params[:id])
        activation = @site.plugin_activations.find_or_initialize_by(installed_plugin_id: record.id)
        activation.active = false
        activation.save!
        redirect_to multisite_routes.admin_site_plugins_path(@site), notice: "Plugin deactivated for #{@site.name}."
      rescue ActiveRecord::RecordNotUnique
        retry
      end

      private

      def find_site
        @site = Site.find(params[:site_id])
      end
    end
  end
end
