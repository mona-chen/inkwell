require "rails_helper"

RSpec.describe "Rails theme helpers", type: :request do
  let(:slug) { "rails-helper-test" }
  let(:root) { Rails.root.join("app/themes", slug) }
  let!(:site) { Site.create!(name: "Helper Site", domain: "www.example.com", is_default: true, active_theme: slug) }
  let(:role) { Role.create!(name: "admin") }
  let(:author) { User.create!(name: "Grace Hopper", email: "grace@example.com", password: "password123", site: site, role: role) }
  let!(:post) { site.posts.create!(title: "Helper story", slug: "helper-story", status: "published", published_at: 1.hour.ago, author: author, content: []) }
  let!(:menu) { site.menus.create!(name: "Main", location: "header") }

  around do |example|
    FileUtils.rm_rf(root)
    FileUtils.mkdir_p(root.join("app/views/layouts"))
    FileUtils.mkdir_p(root.join("app/views/marketing"))
    FileUtils.mkdir_p(root.join("app/views/parts"))
    FileUtils.mkdir_p(root.join("public"))
    root.join("theme.json").write(JSON.generate(
      format: "inkwell-theme-v1", slug: slug, name: "Rails helpers", kind: "rails",
      views: "app/views", public: "public", routes: { "/" => "marketing/home" },
      inkwell: { contract: "1", parts: { header: "parts/header" } }
    ))
    root.join("app/views/layouts/application.html.erb").write("<html><head><title><%= inkwell_seo['title'] %></title></head><body><%= theme_part('header') %><%= yield %></body></html>")
    root.join("app/views/marketing/home.html.erb").write(<<~ERB)
      <h1><%= inkwell_site["name"] %></h1>
      <nav><%= inkwell_navigation.map { |item| item["label"] }.join(",") %></nav>
      <p id="posts"><%= inkwell_posts(limit: 3)["posts"].map { |item| item["title"] }.join(",") %></p>
      <p id="seo"><%= inkwell_seo["canonical"] %></p>
    ERB
    root.join("app/views/parts/_header.html.erb").write("<header id=\"part-header\">Header part</header>")
    example.run
  ensure
    FileUtils.rm_rf(root)
  end

  it "serializes the canonical contract through Rails helpers and renders declared parts" do
    menu.menu_items.create!(label: "Journal", url: "/posts")

    get "/"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Helper Site", "Header part", "Helper story", "Journal")
    expect(response.body).to include("/")
  end
end
