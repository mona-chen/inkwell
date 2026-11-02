module Admin
  class GithubConnectionsController < BaseController
    before_action :platform_admin!
    rescue_from GithubApps::Client::Error, ActiveRecord::RecordInvalid, KeyError, OpenSSL::PKey::PKeyError, with: :connection_error

    def manifest
      base = GithubApps::Setup.public_url(request.base_url)
      raise GithubApps::Client::Error, "Open Inkwell on a public HTTPS URL (or an HTTPS tunnel) before creating the GitHub App." unless base
      raise GithubApps::Client::Error, "A GitHub App is already configured for this site" if Current.site.github_app_connection
      issue_state(:github_manifest, {})
      session[:github_manifest_base] = base
      redirect_to registration_admin_github_connection_path, status: :see_other
    end

    def registration
      pending = session[:github_manifest].to_h
      base = session[:github_manifest_base]
      unless base.present? && pending["nonce"].present? && pending["expires"].to_i > Time.current.to_i && pending["site_id"] == Current.site.id && pending["user_id"] == current_user.id
        raise GithubApps::Client::Error, "GitHub App setup expired; start again"
      end
      manifest = {
        name: "Inkwell #{SecureRandom.hex(4)}", url: base, description: "Theme deployment for #{Current.site.name}",
        hook_attributes: { url: "#{base}/github/hooks/site/#{Current.site.id}", active: true },
        redirect_url: "#{base}/admin/github_connection/callback", callback_urls: ["#{base}/admin/github_connection/authorize"],
        setup_url: "#{base}/admin/github_connection/setup", setup_on_update: true, request_oauth_on_install: false,
        public: true, default_permissions: { contents: "read", metadata: "read" }, default_events: ["push"]
      }
      render Admin::GithubManifestPage.new(manifest: manifest, state: pending.fetch("nonce")), content_type: "text/html"
    end

    def callback
      consume_state!(:github_manifest)
      base = session.delete(:github_manifest_base)
      raise GithubApps::Client::Error, "GitHub App setup expired; start again" unless base
      data = GithubApps::Client.new.convert_manifest(params[:code])
      %w[pem client_secret webhook_secret client_id slug id].each do |key|
        raise GithubApps::Client::Error, "GitHub returned incomplete App credentials" if data[key].blank?
      end
      raise GithubApps::Client::Error, "GitHub returned an invalid private key" unless OpenSSL::PKey::RSA.new(data.fetch("pem")).private?
      Current.site.create_github_app_connection!(user: current_user, app_id: data.fetch("id"), slug: data.fetch("slug"), client_id: data.fetch("client_id"), public_url: base, app_credentials: data.slice("pem", "client_secret", "webhook_secret"))
      redirect_to admin_themes_path(tab: "github"), notice: "GitHub App created. Install it to choose repository access."
    end

    def install
      connection = connection!
      connection.update!(user: current_user)
      # The subsequent OAuth verification checks the actual installing account;
      # a setup callback's installation_id alone is never treated as authorization.
      session[:github_install_started] = { "connection_id" => connection.id, "expires" => 30.minutes.from_now.to_i, "site_id" => Current.site.id }
      redirect_to "https://github.com/apps/#{connection.slug}/installations/new", allow_other_host: true
    end

    def setup
      connection = connection!
      pending = session.delete(:github_install_started).to_h
      unless pending["connection_id"] == connection.id && pending["site_id"] == Current.site.id && pending["expires"].to_i > Time.current.to_i
        raise GithubApps::Client::Error, "Start installation from Inkwell to connect this account"
      end
      id = params[:installation_id].to_s
      raise GithubApps::Client::Error, "Missing installation details" unless id.match?(/\A[1-9]\d{0,18}\z/)
      state = issue_state(:github_authorize, { "installation_id" => id, "connection_id" => connection.id })
      query = URI.encode_www_form(client_id: connection.client_id, redirect_uri: "#{connection.public_url}/admin/github_connection/authorize", state: state)
      redirect_to "https://github.com/login/oauth/authorize?#{query}", allow_other_host: true
    end

    def authorize
      pending = consume_state!(:github_authorize)
      connection = connection!
      raise GithubApps::Client::Error, "GitHub App changed during setup" unless pending["connection_id"] == connection.id
      client = GithubApps::Client.new(connection)
      user_token = client.exchange_user_code(params[:code].to_s)
      actual = client.verify_installation!(user_token, pending.fetch("installation_id"))
      connection.with_lock do
        # A newly selected installation must not silently grant old deployments access.
        if connection.installation_id != actual.fetch("id")
          connection.theme_repository_sources.update_all(auto_update: false, auto_activate: false, updated_at: Time.current)
        end
        connection.update!(installation_id: actual.fetch("id"), account_login: actual.fetch("account").fetch("login"), repositories: [], user: current_user)
      end
      connection.update!(repositories: GithubApps::Client.new(connection).repositories, synced_at: Time.current)
      redirect_to admin_themes_path(tab: "add"), notice: "GitHub connected. Choose a repository to install its theme."
    end

    def refresh
      connection = connection!
      connection.update!(repositories: GithubApps::Client.new(connection).repositories, synced_at: Time.current)
      redirect_to admin_themes_path(tab: "github"), notice: "Repository access refreshed."
    end

    def destroy
      connection!.disconnect!
      redirect_to admin_themes_path(tab: "github"), notice: "Account disconnected locally and automatic deployments paused. The GitHub App registration remains on GitHub."
    end

    private

    def connection!
      Current.site.github_app_connection || raise(GithubApps::Client::Error, "Create the GitHub App first")
    end

    def issue_state(key, data)
      nonce = SecureRandom.hex(32)
      session[key] = data.merge("nonce" => nonce, "site_id" => Current.site.id, "user_id" => current_user.id, "expires" => 30.minutes.from_now.to_i)
      nonce
    end

    def consume_state!(key)
      data = session[key].to_h
      good = data["nonce"].present? && ActiveSupport::SecurityUtils.secure_compare(data["nonce"], params[:state].to_s)
      unless good && data["expires"].to_i > Time.current.to_i && data["site_id"] == Current.site.id && data["user_id"] == current_user.id
        raise GithubApps::Client::Error, "GitHub setup state is invalid or expired; start again"
      end
      session.delete(key)
      data
    end

    def platform_admin!
      head :forbidden unless current_user.admin?
    end

    def connection_error(error)
      Rails.logger.warn("[GitHub setup] #{error.class}")
      message = error.is_a?(GithubApps::Client::Error) ? error.message : "GitHub returned incomplete or invalid App configuration. Start setup again."
      redirect_to admin_themes_path(tab: "github"), alert: message
    end
  end
end
