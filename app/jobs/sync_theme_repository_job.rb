class SyncThemeRepositoryJob < ApplicationJob
  queue_as :default

  def perform(source_id, automatic: false)
    source = ThemeRepositorySource.find_by(id: source_id)
    return unless source
    # Repository code is executable ERB. Only a still-active platform admin can
    # authorize installation or ongoing updates, including scheduled jobs.
    return unless source.user.admin? && !source.user.deactivated?
    source.with_lock do
      return if automatic && !source.auto_update
      source.update!(status: "checking", error_message: nil, checked_at: Time.current)
      github = if source.github_app_connection
        token = GithubApps::Client.new(source.github_app_connection).installation_token
        ThemePackages::Github.new(source.repository, token: token)
      else
        ThemePackages::Github.new(source.repository)
      end
      sha = github.head(source.branch)
      if sha == source.deployed_sha && ThemePackages::Runtime.for(source.installed_slug)
        readiness = ThemePackages::Runtime.for(source.installed_slug)&.readiness_errors
        source.update!(status: readiness&.any? ? "needs_build" : "up_to_date", error_message: readiness&.presence&.join(". "))
        activate_if_authorized!(source, source.installed_slug) if readiness == []
        return
      end
      slug = "github-#{source.id.to_s(36)}-#{sha.first(40)}"
      runtime = ThemePackages::Runtime.for(slug)
      unless runtime
        github.archive(sha) { |archive| ThemePackages::Importer.new.import_zip!(archive, slug: slug, name: source.repository.split("/").last.titleize, spa: source.spa, release_slug: slug) }
        runtime = ThemePackages::Runtime.for(slug)
      end
      errors = runtime.readiness_errors
      source.update!(deployed_sha: sha, installed_slug: slug, status: errors.any? ? "needs_build" : "installed", error_message: errors.presence&.join(". "), releases: source.releases.reject { |release| release["slug"] == slug } + [{ "sha" => sha, "slug" => slug, "installed_at" => Time.current.iso8601 }])
      activate_if_authorized!(source, slug) if errors.empty?
    end
  rescue StandardError => error
    source&.update!(status: "failed", error_message: error.message.to_s.truncate(1000), checked_at: Time.current)
    Rails.logger.error("[Theme repository #{source_id}] #{error.class}")
  end

  private

  def activate_if_authorized!(source, slug)
    return unless source.auto_activate
    authorizer = source.user.reload
    return unless authorizer.admin? && !authorizer.deactivated?
    source.site.with_lock do
      return unless source.site.active_theme == source.activation_base_slug
      return unless ThemeManager.available.include?(slug)
      runtime = ThemePackages::Runtime.for(slug)
      return if runtime && runtime.readiness_errors.any?
      source.site.update!(active_theme: slug)
      source.update!(activation_base_slug: slug)
    end
  end

end
