require "rails_helper"

RSpec.describe "Admin pages render", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  before { sign_in user }

  it "renders the dashboard with the Nitro shell" do
    get admin_root_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-nk=\"app-shell\"")
    expect(body).to include("Set up your site")
    expect(body).to include("0 of 5")
    expect(body).to include("Recent content")
  end

  it "hides the setup guide after the real setup milestones are complete" do
    page = Page.create!(title: "Home", site: site, author: user, status: "published", template: "default")
    menu = site.menus.create!(name: "Primary", location: "header")
    menu.menu_items.create!(label: "Home", url: "/", position: 0)
    site.set_setting!("site_title", "Test Site")
    site.set_setting!("show_on_front", "page")
    site.set_setting!("page_on_front", page.id)

    get admin_root_path

    expect(response).to have_http_status(:ok)
    expect(response.body).not_to include("Set up your site")
  end

  it "renders the posts index with the Nitro shell" do
    get admin_posts_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-nk=\"app-shell\"")
    expect(body).to include("data-nk=\"toolbar\"")
    expect(body).to include("data-nk=\"empty-state\"")
    expect(body).to include("Posts")
  end

  it "renders the pages index with the Nitro shell" do
    get admin_pages_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-nk=\"app-shell\"")
    expect(body).to include("data-nk=\"toolbar\"")
    expect(body).to include("Pages")
  end

  it "renders the media index with the Nitro shell" do
    get admin_media_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-nk=\"app-shell\"")
    expect(body).to include("data-nk=\"toolbar\"")
    expect(body).to include("data-nk=\"card\"")
  end

  it "renders the comments index with the Nitro shell" do
    get admin_comments_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-nk=\"app-shell\"")
    expect(body).to include("data-nk=\"toolbar\"")
    expect(body).to include("data-nk=\"empty-state\"")
    expect(body).to include("Comments")
  end

  it "renders the menus index with the Nitro shell" do
    get admin_menus_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-nk=\"app-shell\"")
    expect(body).to include("data-nk=\"toolbar\"")
    expect(body).to include("data-nk=\"grid\"")
    expect(body).to include("Menus")
  end

  it "renders the settings page with the Nitro shell" do
    get admin_settings_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-nk=\"app-shell\"")
    expect(body).to include("data-nk=\"toolbar\"")
    expect(body).to include("data-nk=\"settings-section\"")
  end

  it "renders the plugins index with the Nitro shell" do
    get admin_plugins_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-nk=\"app-shell\"")
    expect(body).to include("data-nk=\"toolbar\"")
    expect(body).to include("data-nk=\"grid\"")
    expect(body).to include("Plugins")
  end

  it "renders the themes index with the Nitro shell" do
    get admin_themes_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-nk=\"app-shell\"")
    expect(body).to include("data-nk=\"toolbar\"")
    expect(body).to include("data-nk=\"grid\"")
    expect(body).to include("Themes")
  end

  it "renders the post revisions index with the Nitro shell" do
    post = Post.create!(
      title: "Revisioned post",
      site: site,
      author: user,
      status: "draft",
      content: [ { "type" => "paragraph", "data" => { "text" => "v1" } } ]
    )
    post.revisions.create!(
      user: user,
      title_snapshot: "Revisioned post",
      content_snapshot: [ { "type" => "paragraph", "data" => { "text" => "v1" } } ]
    )

    get admin_post_revisions_path(post)
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-nk=\"app-shell\"")
    expect(body).to include("data-nk=\"toolbar\"")
    expect(body).to include("data-nk=\"data-section\"")
    expect(body).to include("Revision history")
  end
end
