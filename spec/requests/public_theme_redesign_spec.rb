require "rails_helper"
RSpec.describe "Redesigned public themes", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Fieldnotes", domain: "fieldnotes.test", active_theme: "default") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:writer) { User.create!(name: "Alex Reed", email: "theme-redesign@example.test", password: "password123", site: site, role: role) }
  let!(:article) { site.posts.create!(title: "Designing for the everyday", author: writer, status: "published", content: [{ type: "paragraph", data: { text: "An article written for real people." } }]) }
  %w[default mono].each do |theme|
    it "renders #{theme} across homepage, archive, article, author, and missing pages" do
      site.update!(active_theme: theme)
      ["/", "/posts", "/posts/#{article.slug}", "/authors/#{writer.to_param}"].each do |path|
        get path
        expect(response).to have_http_status(:ok)
        document = Nokogiri::HTML5.parse(response.body)
        expect(document.at_css("body")['data-public-theme']).to eq(theme)
        expect(document.at_css('link[href*="public_themes"]')).to be_present
        expect(document.at_css("h1")).to be_present
        expect(document.css("details.publication-mobile-menu nav a")).not_to be_empty
      end
      get "/posts/no-such-story"
      expect(response).to have_http_status(:not_found)
    end
  end
  it "previews themes with real content without switching the active theme or homepage" do
    home = site.pages.create!(title: "Existing home", author: writer, template: "landing", status: "published", content: [{ type: "paragraph", data: { text: "Existing live homepage" } }])
    site.set_setting!("show_on_front", "page")
    site.set_setting!("page_on_front", home.id)
    sign_in writer
    get "/?preview_theme=mono&theme_home=1"
    expect(response.body).to include('data-public-theme="mono"', article.title)
    expect(site.reload.active_theme).to eq("default")
    expect(site.front_page.id).to eq(home.id)
    get "/posts?preview_theme=mono"
    expect(response.body).to include('data-public-theme="mono"', 'preview_theme=mono')
    sign_out writer
    get "/?preview_theme=mono&theme_home=1"
    expect(response.body).to include("Existing live homepage")
    expect(response.body).not_to include('data-public-theme="mono"')
  end
  it "can preview theme defaults without changing a published custom template" do
    template = site.pages.create!(title: "Custom post layout", author: writer, template: "landing", status: "published", template_for: "single_post", content: [{ type: "page_builder", data: { html: "<p>Custom layout marker</p>" } }])
    sign_in writer
    get "/posts/#{article.slug}?preview_theme=mono&theme_defaults=1"
    expect(response.body).to include("publication-article-head", article.title)
    expect(response.body).not_to include("Custom layout marker")
    expect(template.reload.status).to eq("published")
    get "/posts/#{article.slug}?preview_theme=mono"
    expect(response.body).to include("Custom layout marker")
  end

end
