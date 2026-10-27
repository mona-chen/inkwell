require "rails_helper"

RSpec.describe "Admin design and dashboard", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Design site", domain: "design.test") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:user) { User.create!(name: "Editor", email: "design@example.test", password: "password123", site: site, role: role) }
  before { sign_in user }

  it "renders the overview and every site design section" do
    ["/admin", "/admin/design", "/admin/design?section=parts", "/admin/design?section=styles", "/admin/templates", "/admin/themes", "/admin/menus", "/admin/widgets", "/admin/pages"].each do |path|
      get path
      expect(response).to have_http_status(:ok), "#{path}: #{response.status}"
    end
  end

  it "keeps a new template out of public resolution and reuses its assignment" do
    2.times { post "/admin/templates/single_post" }
    expect(site.pages.where(template_for: "single_post").count).to eq(1)
    expect(Page.template_for(site, "single_post")).to be_nil
    get "/admin/templates"
    expect(response.body).to include("Draft", "Edit template")
  end

  it "keeps a live template unchanged until the Builder publishes" do
    template = site.pages.create!(title: "Post layout", author: user, template: "default", template_for: "single_post", status: "published", content: [{ type: "page_builder", data: { html: "<p>Live layout</p>" } }])
    payload = { record_type: "page", record_id: template.id, html: "<p>Working layout</p>", store: { version: 2, type: "page", settings: {}, children: [] } }
    post "/builder/save", params: payload, as: :json
    expect(response).to have_http_status(:ok)
    expect(template.reload.content_blocks.first.dig("data", "html")).to include("Live layout")
    expect(template.editing_blocks.first.dig("data", "html")).to include("Working layout")
    get "/builder/page/#{template.id}/preview"
    expect(response.body).to include("Working layout")
    post "/builder/save", params: payload.merge(publish: true), as: :json
    expect(template.reload.content_blocks.first.dig("data", "html")).to include("Working layout")
    expect(template.draft_content).to be_nil
  end

  it "restores the theme default without deleting the design" do
    template = site.pages.create!(title: "Custom template", author: user, template: "default", template_for: "single_post", status: "published")
    delete "/admin/templates/single_post"
    expect(template.reload.template_for).to be_nil
    expect(template.status).to eq("draft")
    expect(Page.template_for(site, "single_post")).to be_nil
  end

  it "discards only unpublished template changes" do
    template = site.pages.create!(title: "Custom template", author: user, template: "default", template_for: "single_post", status: "published", content: [], draft_content: [{ type: "paragraph", data: { text: "Working" } }])
    delete "/admin/templates/single_post/draft"
    expect(template.reload.draft_content).to be_nil
    expect(template.status).to eq("published")
    expect(template.template_for).to eq("single_post")
  end

  it "saves constrained site styles and exposes them to published Builder content" do
    patch "/admin/design", params: { styles: { primary: "#123abc", text: "</style><script>bad</script>", baseSize: 18, pageGutter: 24, font: "serif" } }
    expect(response).to redirect_to("/admin/design?section=styles")
    expect(site.reload.builder_styles.css).to include("--ink-site-color-primary:#123abc", "--ink-site-base-size:18.0px")
    expect(site.builder_styles.css).not_to include("script>")
    page = site.pages.create!(title: "Styled page", author: user, template: "landing", status: "published", content: [{ type: "page_builder", data: { html: "<p>Native content</p>" } }])
    get "/pages/#{page.slug}"
    expect(response.body).to include("--ink-site-color-primary:#123abc", "Native content")
  end

  it "includes pages in recent work without counting templates as ordinary pages" do
    site.pages.create!(title: "Recent page", author: user, template: "default", status: "draft")
    site.pages.create!(title: "Layout only", author: user, template: "default", template_for: "index", status: "draft")
    get "/admin"
    expect(response.body).to include("Recent page")
    expect(response.body).not_to include("Layout only", "Good morning", "Good evening")
  end

  it "resolves native plugin icon names" do
    expect(Admin::Shell.icon_name("sparkles")).to eq(:sparkles)
    expect(Admin::Shell.icon_name("globe_2")).to eq(:globe_2)
    expect(Admin::Shell.icon_name("unknown-ink-icon")).to eq(:puzzle)
  end
  it "keeps shared part edits with a template draft without updating the site registry" do
    template = site.pages.create!(title: "Draft parts", author: user, template: "default", template_for: "index", status: "draft")
    post "/builder/save", params: { record_type: "page", record_id: template.id, html: "<main>Draft</main>", site_parts: { header: { id: "draft-header", type: "site-part", settings: { partKey: "header" }, children: [] } } }, as: :json
    expect(response).to have_http_status(:ok)
    expect(site.reload.builder_site_parts).to eq({})
    expect(template.reload.editing_blocks.first.dig("data", "site_parts", "header", "id")).to eq("draft-header")
    get "/builder/page/#{template.id}"
    expect(response.body).to include("draft-header")
  end

  it "does not mix another site's pending comments into the navigation badge" do
    own_post = site.posts.create!(title: "Own post", author: user, status: "published")
    other_site = Site.create!(name: "Other site", domain: "other.test")
    other_post = other_site.posts.create!(title: "Other post", author: user, status: "published")
    Comment.create!(post: own_post, user: user, body: "Own comment", status: "pending")
    2.times { Comment.create!(post: other_post, user: user, body: "Other comment", status: "pending") }
    get "/admin"
    document = Nokogiri::HTML(response.body)
    badge = document.at_css('nav[aria-label="Workspace navigation"] a[href="/admin/comments"]')
    expect(badge.css("span").last.text).to eq("1")
    expect(response.body).to include("Waiting for moderation")
    expect(response.body).not_to include("Comments are up to date")
  end

  it "opens a dedicated shared-part editor without creating an ordinary page" do
    2.times { post "/admin/design/parts/header/edit" }
    template = site.pages.find_by!(template_for: "site_header")
    expect(response).to redirect_to("/builder/page/#{template.id}?panel=site")
    expect(site.pages.where(template_for: "site_header").count).to eq(1)
    expect(template.content_blocks.first.dig("data", "store", "children", 0, "settings", "partKey")).to eq("header")
    expect(site.reload.builder_site_parts).to eq({})
  end

  it "publishes a complete template draft through the conventional page form" do
    template = site.pages.create!(title: "Conventional publish", author: user, template: "default", template_for: "single_post", status: "published", content: [{ type: "page_builder", data: { html: "Old output" } }], draft_content: [{ type: "page_builder", data: { html: "New output", store: { version: 2 } } }])
    post "/admin/pages/#{template.slug}/publish"
    expect(template.reload.content_blocks.first.dig("data", "html")).to eq("New output")
    expect(template.content_blocks.first.dig("data", "store", "version")).to eq(2)
  end

end
