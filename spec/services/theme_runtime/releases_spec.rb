require "rails_helper"

RSpec.describe ThemeRuntime::Releases do
  let!(:site) { Site.create!(name: "Release site", domain: "release-site.test", is_default: true, active_theme: "default") }

  it "activates an installed static release and backfills declared routes" do
    result = described_class.activate!(site: site, slug: "ruut-website")
    expect(result[:previous]).to eq("default")
    expect(site.reload.active_theme).to eq("ruut-website")

    manifest = JSON.parse(Rails.root.join("app/themes/ruut-website/theme.json").read)
    routes = site.theme_routes.where(theme_release_id: "ruut-website")
    expect(routes.count).to eq(manifest.fetch("routes").size)
    expect(routes.pluck(:path)).to include("/", "/chat", "/voice")
    expect(routes.find_by(path: "/")).to be_published
  end

  it "preserves CMS metadata when the manifest is synchronized again" do
    described_class.activate!(site: site, slug: "ruut-website")
    route = site.theme_routes.find_by(path: "/chat")
    route.update!(seo_title: "Chat with Ruut", meta_description: "Custom description")

    ThemeRoutes::Synchronizer.new(site: site, theme_slug: "ruut-website").sync!

    expect(route.reload.seo_title).to eq("Chat with Ruut")
    expect(route.meta_description).to eq("Custom description")
  end

  it "rolls back to the previous explicit release" do
    described_class.activate!(site: site, slug: "ruut-website")
    described_class.rollback!(site: site)
    expect(site.reload.active_theme).to eq("default")
  end

  it "keeps route metadata attached to each release for previews" do
    site.theme_routes.create!(path: "/about", route_key: "about", theme_release_id: "release-a")
    site.theme_routes.create!(path: "/about", route_key: "about", theme_release_id: "release-b")

    expect(site.theme_routes.where(path: "/about").count).to eq(2)
    expect(ThemeRoute.match(site: site, path: "/about", release: "release-a")).to be_present
  end

  it "refuses a release that is not installed" do
    expect { described_class.activate!(site: site, slug: "not-installed") }.to raise_error(ThemeRuntime::Releases::Error, /Unknown/)
  end
end
