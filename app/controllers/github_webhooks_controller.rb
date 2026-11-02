class GithubWebhooksController < ActionController::API
  def create
    connection = GithubAppConnection.find_by(site_id: params[:site_id])
    return head :not_found unless connection && connection.authorized?
    body = request.body.read(2.megabytes + 1)
    return head :payload_too_large if body.bytesize > 2.megabytes
    secret = connection.app_credentials["webhook_secret"]
    return head :forbidden if secret.blank?
    expected = "sha256=#{OpenSSL::HMAC.hexdigest('SHA256', secret, body)}"
    return head :forbidden unless ActiveSupport::SecurityUtils.secure_compare(expected, request.headers["X-Hub-Signature-256"].to_s)
    data = JSON.parse(body)
    return head :bad_request unless data.is_a?(Hash)
    return head :accepted if request.headers["X-GitHub-Event"] == "ping"
    return head :accepted unless connection.connected? && data.dig("installation", "id").to_s == connection.installation_id.to_s
    case request.headers["X-GitHub-Event"]
    when "push"
      unless data["deleted"]
        connection.theme_repository_sources.where(repository: data.dig("repository", "full_name"), auto_update: true).find_each do |source|
          SyncThemeRepositoryJob.perform_later(source.id, automatic: true) if data["ref"] == "refs/heads/#{source.branch}"
        end
      end
    when "installation"
      connection.disconnect! if %w[deleted suspend].include?(data["action"])
    when "installation_repositories"
      # A permission refresh must come from GitHub, not from an unverified query parameter.
      removed = Array(data["repositories_removed"]).map { |repo| repo["full_name"] }
      connection.theme_repository_sources.where(repository: removed).update_all(auto_update: false, auto_activate: false, updated_at: Time.current)
      connection.update!(repositories: connection.repositories.reject { |repo| removed.include?(repo["full_name"]) })
    end
    head :accepted
  rescue JSON::ParserError
    head :bad_request
  end
end
