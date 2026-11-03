require "rails_helper"

RSpec.describe "Theme route administration", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let!(:site) { Site.create!(name: "Theme admin", domain: "www.example.com", is_default: true, active_theme: "default") }
  let(:admin) { User.create!(name: "Admin", email: "theme-routes@example.com", password: "password123", site: site, role: role) }
  let!(:route) do
    site.theme_routes.create!(path: "/about", route_key: "about", theme_release_id: "default",
      title_override: "About the studio", seo_title: "About", meta_description: "Old description", status: "draft")
  end

  before { sign_in admin }

  it "lists theme routes in Pages with a Theme badge" do
    get "/admin/pages"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("About the studio", "Theme", "/about")
  end

  it "edits SEO with optimistic concurrency and keeps revision history" do
    get "/admin/theme_routes/#{route.id}/edit"
    expect(response).to have_http_status(:ok)

    patch "/admin/theme_routes/#{route.id}", params: { theme_route: { revision: route.revision, meta_description: "New description", seo_title: "New SEO" } }
    expect(response).to redirect_to("/admin/theme_routes/#{route.id}/edit")
    expect(route.reload.meta_description).to eq("New description")
    expect(route.revisions.count).to eq(1)

    stale_revision = route.revision
    patch "/admin/theme_routes/#{route.id}", params: { theme_route: { revision: stale_revision - 1, meta_description: "Stale" } }
    expect(response).to have_http_status(:conflict)
    expect(route.reload.meta_description).to eq("New description")

    restore = route.revisions.last
    post "/admin/theme_routes/#{route.id}/restore", params: { revision_id: restore.id }
    expect(response).to redirect_to("/admin/theme_routes/#{route.id}/edit")
    expect(route.reload.meta_description).to eq("Old description")
  end

  it "publishes and unpublishes a route" do
    post "/admin/theme_routes/#{route.id}/publish"
    expect(route.reload).to be_published

    post "/admin/theme_routes/#{route.id}/unpublish"
    expect(route.reload.status).to eq("draft")
  end

  it "stores declared editable region overrides separately and can reset them" do
    allow(ThemeRuntime::EditableRegions).to receive(:new).and_wrap_original do |original, **args|
      instance = original.call(**args)
      allow(instance).to receive(:declarations).and_return("homepage_hero" => { "type" => "rich_text", "builder" => true })
      instance
    end

    patch "/admin/theme_regions/homepage_hero", params: { data: { html: "<h1>Hello</h1>" } }, as: :json
    expect(response).to have_http_status(:ok)
    expect(site.theme_region_overrides.find_by(region_key: "homepage_hero").data).to eq("html" => "<h1>Hello</h1>")

    delete "/admin/theme_regions/homepage_hero/reset"
    expect(site.theme_region_overrides.where(region_key: "homepage_hero")).to be_empty
  end
end
