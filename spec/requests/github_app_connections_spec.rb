require "rails_helper"

RSpec.describe "GitHub App connections", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "GitHub site", domain: "github-app.test", active_theme: "default") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:user) { User.create!(name: "Admin", email: "github-app@test.example", password: "password123", role: role, site: site) }
  let(:key) { OpenSSL::PKey::RSA.generate(2048) }
  let(:credentials) { { "pem" => key.to_pem, "client_secret" => "private-client-secret", "webhook_secret" => "private-hook-secret" } }
  let(:connection) { site.create_github_app_connection!(user: user, app_id: 123, slug: "inkwell-test", client_id: "client-id", public_url: "https://inkwell.example", app_credentials: credentials, installation_id: 456, account_login: "owner", repositories: [{ "full_name" => "owner/theme", "default_branch" => "release" }]) }
  before { sign_in user }

  it "separates installed themes from installation and connection settings" do
    get "/admin/themes"
    expect(response.body).to include("Installed themes")
    expect(response.body).not_to include('name="theme_repository_source[repository]"')
    get "/admin/themes?tab=github"
    expect(response.body).to include("Create GitHub App")
    get "/admin/themes?tab=add"
    expect(response.body).to include("Install from GitHub", "Public repository URL")
  end

  it "registers through a single-use manifest state and encrypts credentials" do
    allow(GithubApps::Setup).to receive(:public_url).and_return("https://inkwell.example")
    post "/admin/github_connection/manifest"
    expect(response).to have_http_status(:ok)
    document = Nokogiri::HTML(response.body)
    state = URI.decode_www_form(URI(document.at_css('form')['action']).query).to_h.fetch("state")
    manifest = JSON.parse(document.at_css('input[name=manifest]')['value'])
    expect(manifest.fetch("default_permissions")).to eq("contents" => "read", "metadata" => "read")
    expect(manifest.dig("hook_attributes", "url")).to end_with("/github/hooks/site/#{site.id}")
    expect_any_instance_of(GithubApps::Client).to receive(:convert_manifest).with("valid-code").once.and_return(credentials.merge("id" => 123, "slug" => "inkwell-test", "client_id" => "client-id"))
    get "/admin/github_connection/callback", params: { state: state, code: "valid-code" }
    saved = site.reload.github_app_connection
    expect(saved.app_credentials).to eq(credentials)
    expect(saved.credentials_ciphertext).not_to include("private-client-secret", "PRIVATE KEY", "private-hook-secret")
    get "/admin/github_connection/callback", params: { state: state, code: "valid-code" }
    expect(GithubAppConnection.count).to eq(1)
    expect(response).to redirect_to(admin_themes_path(tab: "github"))
  end

  it "rejects an unsolicited installation callback" do
    connection
    expect_any_instance_of(GithubApps::Client).not_to receive(:exchange_user_code)
    get "/admin/github_connection/setup", params: { installation_id: 789 }
    expect(connection.reload.installation_id).to eq(456)
    expect(response).to redirect_to(admin_themes_path(tab: "github"))
  end

  it "verifies installation access through OAuth before connecting" do
    connection.update!(installation_id: nil)
    post "/admin/github_connection/install"
    expect(response).to redirect_to("https://github.com/apps/inkwell-test/installations/new")
    get "/admin/github_connection/setup", params: { installation_id: 789 }
    state = URI.decode_www_form(URI(response.location).query).to_h.fetch("state")
    expect_any_instance_of(GithubApps::Client).to receive(:exchange_user_code).with("oauth-code").and_return("user-token")
    expect_any_instance_of(GithubApps::Client).to receive(:verify_installation!).with("user-token", "789").and_return("id" => 789, "account" => { "login" => "verified-owner" })
    expect_any_instance_of(GithubApps::Client).to receive(:repositories).and_return([{ "full_name" => "verified-owner/private-theme", "default_branch" => "main" }])
    get "/admin/github_connection/authorize", params: { state: state, code: "oauth-code" }
    expect(connection.reload).to have_attributes(installation_id: 789, account_login: "verified-owner")
    get "/admin/themes?tab=add"
    expect(response.body).to include("verified-owner/private-theme", "github_app_connection_id")
    expect(response.body).not_to include("private-client-secret")
  end

  it "accepts only the installation's listed repositories" do
    expect(SyncThemeRepositoryJob).not_to receive(:perform_later)
    post "/admin/theme_repository_sources", params: { theme_repository_source: { repository: "other/private", github_app_connection_id: connection.id } }
    expect(site.theme_repository_sources).to be_empty
  end

  it "disconnects locally and pauses both automatic deployment options" do
    source = site.theme_repository_sources.create!(user: user, repository: "owner/theme", github_app_connection: connection, auto_update: true, auto_activate: true)
    delete "/admin/github_connection"
    expect(connection.reload).not_to be_connected
    expect(source.reload).to have_attributes(auto_update: false, auto_activate: false)
    expect(connection.app_credentials).to eq(credentials)
  end

  it "restricts App registration to platform administrators" do
    user.update!(role: Role.create!(name: "manager", capabilities: ["manage_site"]))
    post "/admin/github_connection/manifest"
    expect(response).to have_http_status(:forbidden)
  end

  def webhook(data, signature: true, event: "push")
    body = data.to_json
    digest = OpenSSL::HMAC.hexdigest("SHA256", credentials.fetch("webhook_secret"), body)
    post "/github/hooks/site/#{site.id}", params: body, headers: { "CONTENT_TYPE" => "application/json", "X-GitHub-Event" => event, "X-Hub-Signature-256" => signature ? "sha256=#{digest}" : "sha256=invalid" }
  end

  it "enqueues only signed pushes for the configured branch and installation" do
    source = site.theme_repository_sources.create!(user: user, repository: "owner/theme", branch: "release", github_app_connection: connection, auto_update: true)
    data = { installation: { id: 456 }, repository: { full_name: "owner/theme" }, ref: "refs/heads/release" }
    expect(SyncThemeRepositoryJob).to receive(:perform_later).with(source.id, automatic: true).once
    webhook(data, signature: false)
    expect(response).to have_http_status(:forbidden)
    webhook(data.merge(ref: "refs/heads/main"))
    webhook(data.merge(installation: { id: 999 }))
    webhook(data)
    expect(response).to have_http_status(:accepted)
  end

  it "pauses deployments when repository access is removed" do
    source = site.theme_repository_sources.create!(user: user, repository: "owner/theme", github_app_connection: connection, auto_update: true, auto_activate: true)
    webhook({ installation: { id: 456 }, repositories_removed: [{ full_name: "owner/theme" }] }, event: "installation_repositories")
    expect(source.reload).to have_attributes(auto_update: false, auto_activate: false)
    expect(connection.reload.repositories).to be_empty
  end
end
