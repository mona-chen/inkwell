require "rails_helper"

RSpec.describe AgentAccess::ThemeTools do
  let(:role) { Role.create!(name: "admin") }
  let!(:site) { Site.create!(name: "Agent theme", domain: "agent-theme.test", is_default: true, active_theme: "default") }
  let(:user) { User.create!(name: "Agent", email: "agent-theme@example.com", password: "password123", site: site, role: role) }
  let(:credential) do
    AgentCredential.issue!(site: site, user: user, name: "Theme bot", scopes: %w[site:read theme:read theme:write theme:release]).first
  end
  let(:registry) { AgentAccess::Registry.new(credential) }

  it "reads and updates route SEO with optimistic concurrency" do
    route = site.theme_routes.create!(path: "/about", route_key: "about", theme_release_id: "default", status: "published", meta_description: "Old")

    read = registry.call("theme.routes_read", {})
    expect(read[:isError]).to be(false)
    expect(read[:structuredContent][:routes].first[:revision]).to eq(route.revision)

    updated = registry.call("theme.route_update_seo", {
      "id" => route.id, "expected_revision" => route.revision,
      "values" => { "meta_description" => "New", "seo_title" => "About us" }
    })
    expect(updated[:isError]).to be(false)
    expect(route.reload.meta_description).to eq("New")
    expect(route.revisions.count).to eq(1)

    stale = registry.call("theme.route_update_seo", {
      "id" => route.id, "expected_revision" => route.revision - 1,
      "values" => { "meta_description" => "Stale" }
    })
    expect(stale[:isError]).to be(true)
    expect(route.reload.meta_description).to eq("New")
  end

  it "reads declared parts and editable regions without exposing release source mutation" do
    site.update!(active_theme: "ruut-website")

    parts = registry.call("theme.parts_read", {})
    expect(parts[:isError]).to be(false)
    expect(parts[:structuredContent][:parts].map { |part| part[:key] }).to include("header", "footer", "navigation", "comments")

    regions = registry.call("theme.editable_regions_read", {})
    expect(regions[:isError]).to be(false)
    expect(regions[:structuredContent][:regions].map { |region| region["key"] }).to eq(%w[homepage_hero featured_posts])
  end

  it "activates and rolls back releases as explicit audited operations" do
    activated = registry.call("theme.release_activate", { "slug" => "mono", "expected_active_release" => "default" })
    expect(activated[:isError]).to be(false)
    expect(site.reload.active_theme).to eq("mono")
    expect(site.setting("previous_theme_release")).to eq("default")

    rolled_back = registry.call("theme.release_rollback", { "expected_active_release" => "mono" })
    expect(rolled_back[:isError]).to be(false)
    expect(site.reload.active_theme).to eq("default")
    expect(site.agent_activities.where(tool: %w[theme.release_activate theme.release_rollback]).count).to eq(2)
  end
end
