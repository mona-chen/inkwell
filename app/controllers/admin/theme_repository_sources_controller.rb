module Admin
  class ThemeRepositorySourcesController < BaseController
    before_action :platform_admin!

    def create
      source = Current.site.theme_repository_sources.create!(source_params.merge(user: current_user))
      SyncThemeRepositoryJob.perform_later(source.id)
      redirect_to admin_themes_path, notice: "GitHub theme installation queued. Refresh to see the result."
    rescue ActiveRecord::RecordInvalid => error
      redirect_to admin_themes_path, alert: error.record.errors.full_messages.to_sentence
    end

    def update
      source = Current.site.theme_repository_sources.find(params[:id])
      source.with_lock do
        source.update!(params.require("repository_#{source.id}").permit(:auto_update, :auto_activate).merge(user: current_user))
        source.update!(activation_base_slug: source.site.reload.active_theme) if source.auto_activate
      end
      redirect_to admin_themes_path, notice: "Repository update preferences saved."
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
      params.require(:theme_repository_source).permit(:repository, :branch, :auto_update, :auto_activate, :spa)
    end
  end
end
