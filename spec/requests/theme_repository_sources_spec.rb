require "rails_helper"
RSpec.describe "GitHub theme connections", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Repo site", domain: "repo-theme.test", active_theme: "default") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:user) { User.create!(name: "Admin", email: "theme-repo@test.example", password: "password123", role: role, site: site) }
  before { sign_in user }

  it "shows GitHub installation and creates a queued site-scoped source" do
    get "/admin/themes?tab=add"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Install from GitHub", "theme_repository_source[repository]")
    expect(SyncThemeRepositoryJob).to receive(:perform_later).with(kind_of(Integer))
    post "/admin/theme_repository_sources", params: { theme_repository_source: { repository: "https://github.com/owner/theme.git", branch: "release", auto_update: "1", auto_activate: "0" } }
    expect(response).to redirect_to(admin_themes_path)
    source = site.theme_repository_sources.last
    expect(source).to have_attributes(repository: "owner/theme", branch: "release", auto_update: true, auto_activate: false)
    get "/admin/themes"
    expect(response.body).to include("owner/theme", "Automatic updates")
    patch "/admin/theme_repository_sources/#{source.id}", params: { "repository_#{source.id}" => { auto_update: "0", auto_activate: "0" } }
    expect(source.reload.auto_update).to eq(false)
  end

  it "rejects non-GitHub URLs without enqueuing code downloads" do
    expect(SyncThemeRepositoryJob).not_to receive(:perform_later)
    post "/admin/theme_repository_sources", params: { theme_repository_source: { repository: "https://example.com/site", branch: "main" } }
    expect(site.theme_repository_sources.count).to eq(0)
  end

  it "requires platform-admin permission even for a site manager" do
    manager_role = Role.create!(name: "manager", capabilities: ["manage_site"])
    user.update!(role: manager_role)
    post "/admin/theme_repository_sources", params: { theme_repository_source: { repository: "owner/theme" } }
    expect(response).to have_http_status(:forbidden)
    expect(site.theme_repository_sources.count).to eq(0)
  end

  it "does not allow another site's connection to be controlled" do
    other = Site.create!(name: "Other", domain: "other-theme.test")
    source = other.theme_repository_sources.create!(user: user, repository: "owner/theme")
    post "/admin/theme_repository_sources/#{source.id}/sync"
    expect(response).to have_http_status(:not_found)
  end
  it "activates a selected historical release and pauses automatic activation" do
    slug = "github-action-#{SecureRandom.hex(4)}"
    root = Rails.root.join("app/themes", slug)
    FileUtils.mkdir_p(root.join("public"))
    root.join("public/index.html").write("<h1>Historical release</h1>")
    root.join("theme.json").write(JSON.generate(format: "inkwell-theme-v1", slug: slug, name: "Historical", kind: "static", routes: { "/" => "index.html" }))
    source = site.theme_repository_sources.create!(user: user, repository: "owner/theme", auto_activate: true, releases: [{ "sha" => "a" * 40, "slug" => slug }])
    post "/admin/theme_repository_sources/#{source.id}/activate", params: { slug: slug }
    expect(response).to redirect_to(admin_themes_path)
    expect(site.reload.active_theme).to eq(slug)
    expect(source.reload.auto_activate).to eq(false)
  ensure
    FileUtils.rm_rf(root) if root
  end

end
