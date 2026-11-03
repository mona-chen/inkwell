module Admin
  class ThemeRepositorySourcesController < BaseController
    before_action :platform_admin!

    def create
      attrs = source_params
      if attrs[:github_app_connection_id].present?
        connection = Current.site.github_app_connection
        raise GithubApps::Client::Error, "Connect GitHub and select an accessible repository first" unless connection&.connected? && connection.authorized? && connection.id.to_s == attrs[:github_app_connection_id].to_s
        raise GithubApps::Client::Error, "Repository is outside the installation's access; refresh repository access" unless connection.repositories.any? { |repo| repo["full_name"] == attrs[:repository] }
      end
      source = Current.site.theme_repository_sources.create!(attrs.merge(user: current_user))
      SyncThemeRepositoryJob.perform_later(source.id)
      redirect_to admin_themes_path, notice: "GitHub theme installation queued. Refresh to see the result."
    rescue ActiveRecord::RecordInvalid, GithubApps::Client::Error => error
      redirect_to admin_themes_path, alert: error.is_a?(ActiveRecord::RecordInvalid) ? error.record.errors.full_messages.to_sentence : error.message
    end

    def update
      source = Current.site.theme_repository_sources.find(params[:id])
      branch_changed = false
      source.with_lock do
        source.update!(params.require("repository_#{source.id}").permit(:branch, :auto_update, :auto_activate).merge(user: current_user))
        branch_changed = source.saved_change_to_branch?
        # A different branch is a new deployment target: review its first release.
        source.update!(auto_activate: false) if branch_changed
        source.update!(activation_base_slug: source.site.reload.active_theme) if source.auto_activate
      end
      SyncThemeRepositoryJob.perform_later(source.id) if branch_changed
      redirect_to admin_themes_path, notice: branch_changed ? "Deploy branch updated. Installation queued; review the release before activating." : "Repository update preferences saved."
    rescue ActiveRecord::RecordInvalid => error
      redirect_to admin_themes_path, alert: error.record.errors.full_messages.to_sentence
    end

    def sync
      source = Current.site.theme_repository_sources.find(params[:id])
      SyncThemeRepositoryJob.perform_later(source.id)
      redirect_to admin_themes_path, notice: "Repository check queued."
    end

    def activate
      source = Current.site.theme_repository_sources.find(params[:id])
      source.with_lock do
        release = source.releases.find { |item| item["slug"] == params[:slug] }
        raise ThemePackages::Invalid, "Unknown release" unless release
        runtime = ThemePackages::Runtime.for(release["slug"])
        raise ThemePackages::Invalid, "Release is missing from this server" unless runtime
        raise ThemePackages::Invalid, runtime.readiness_errors.join(". ") if runtime.readiness_errors.any?
        Current.site.update!(active_theme: release["slug"])
        # A manual deployment/rollback always pauses automatic activation.
        source.update!(auto_activate: false)
      end
      redirect_to admin_themes_path, notice: "Theme release activated. Automatic activation paused."
    rescue ThemePackages::Invalid => error
      redirect_to admin_themes_path, alert: error.message
    end

    private

    def platform_admin!
      head :forbidden unless current_user.admin?
    end

    def source_params
      params.require(:theme_repository_source).permit(:repository, :branch, :auto_update, :auto_activate, :spa, :github_app_connection_id)
    end
  end
end
