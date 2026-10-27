module Admin
  class LivePluginsController < BaseController
    def update
      head :forbidden and return unless current_user.admin? || current_user.manages_site?(Current.site)
      plugin = Current.site.live_plugins.find(params[:id])
      plugin.with_lock do
        expected = params[:expected_active_release_id].presence&.to_i
        raise AgentAccess::Error, "Deployment changed. Refresh before applying." unless plugin.active_release_id == expected
        release = plugin.releases.find(params[:release_id]) if params[:release_id].present?
        before = { "slug" => plugin.slug, "active_release_id" => plugin.active_release_id }
        plugin.update!(active_release: release)
        Current.site.agent_activities.create!(tool: "admin.plugin_activate", status: "success", before_state: before, after_state: { "slug" => plugin.slug, "active_release_id" => plugin.active_release_id })
      end
      redirect_to admin_settings_path(section: "agents"), notice: "Plugin deployment updated. Refresh public pages to see the change."
    rescue AgentAccess::Error => e
      redirect_to admin_settings_path(section: "agents"), alert: e.message
    end
  end
end
