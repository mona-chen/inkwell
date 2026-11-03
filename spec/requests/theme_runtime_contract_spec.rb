require "rails_helper"
require "tmpdir"

RSpec.describe "Theme runtime contract", type: :request do
  let(:theme_slug) { "contract-test" }
  let(:theme_root) { Rails.root.join("app/themes", theme_slug) }
  let!(:site) { Site.create!(name: "Contract Site", domain: "www.example.com", active_theme: theme_slug) }
  let(:role) { Role.create!(name: "admin") }
  let(:author) { User.create!(name: "Ada Lovelace", email: "ada-contract@example.com", password: "password123", site: site, role: role) }
  let!(:post) do
    site.posts.create!(title: "A sample story", slug: "a-sample-story", status: "published", published_at: 1.hour.ago, author: author,
      excerpt: "A useful excerpt",
      content: [ { "type" => "paragraph", "data" => { "text" => "Hello from the contract." } } ])
  end
  let!(:comment) do
    post.comments.create!(body: "A thoughtful reply", guest_name: "Maya", guest_email: "maya@example.com", status: "approved")
  end

  around do |example|
    FileUtils.rm_rf(theme_root)
    FileUtils.mkdir_p(theme_root.join("public/assets"))
    FileUtils.mkdir_p(theme_root.join("inkwell/fixtures"))
    FileUtils.mkdir_p(theme_root.join("inkwell/parts"))
    theme_root.join("public/index.html").write(<<~HTML)
      <!doctype html><html><head><title>Fallback</title></head><body>
        <div data-inkwell-part="header"></div>
        <nav data-inkwell-region="navigation"></nav>
        <main><section data-inkwell-region="posts" data-inkwell-limit="6"></section></main>
        <script type="module" src="/assets/app.js"></script>
      </body></html>
    HTML
    theme_root.join("public/blog.html").write(<<~HTML)
      <!doctype html><html><head></head><body><h1>Journal</h1><div data-inkwell-region="posts"></div></body></html>
    HTML
    theme_root.join("public/post.html").write(<<~HTML)
      <!doctype html><html><head></head><body><article data-inkwell-region="post"></article><section data-inkwell-region="comments"></section></body></html>
    HTML
    theme_root.join("public/about.html").write("<!doctype html><html><head></head><body><h1>About us</h1></body></html>")
    theme_root.join("public/assets/app.js").write("window.contractTheme = true")
    theme_root.join("theme.json").write(JSON.generate({
      format: "inkwell-theme-v1", slug: theme_slug, name: "Contract Test", kind: "static", public: "public",
      routes: { "/" => "index.html", "/blog" => "blog.html", "/blog/:slug" => "post.html", "/about" => "about.html" },
      spa_fallback: "index.html",
      inkwell: {
        contract: "1", runtime: "server_injected", fixtures: "inkwell/fixtures",
        templates: { blog_index: "blog", blog_post: "post" },
        parts: { header: "inkwell/parts/header.html" },
        content_types: %w[posts pages authors comments categories tags],
        editable_regions: { homepage_hero: { type: "rich_text", builder: true } }
      }
    }))
    theme_root.join("inkwell/parts/header.html").write("<header data-part-rendered>Header <span data-inkwell-region=\"site\"></span></header>")
    theme_root.join("inkwell/fixtures/site.json").write(JSON.generate(id: "fixture-site", name: "Fixture Site", url: "https://fixture.test", logo: nil))
    theme_root.join("inkwell/fixtures/navigation.json").write(JSON.generate([ { label: "Journal", url: "/blog", active: false, children: [] } ]))
    theme_root.join("inkwell/fixtures/posts.json").write(JSON.generate([ { type: "post", id: "fixture-1", title: "Fixture story", slug: "fixture-story", url: "/blog/fixture-story", html: "<p>Fixture text</p>", excerpt: "Fixture excerpt", published_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-02T00:00:00Z", author: {}, seo: {} } ]))
    theme_root.join("inkwell/fixtures/authors.json").write("[]")
    theme_root.join("inkwell/fixtures/comments.json").write("[]")
    example.run
  ensure
    FileUtils.rm_rf(theme_root)
  end

  it "renders the shell, server-injected data and declared regions with canonical SEO" do
    get "/"

    expect(response).to have_http_status(:ok)
    document = Nokogiri::HTML(response.body)
    expect(document.at_css("title").text).to include("Contract Site")
    expect(document.at_css("meta[name='inkwell-rendering']")["content"]).to eq("server")
    expect(document.at_css("script#inkwell-data")["data-inkwell-contract"]).to eq("1")
    data = JSON.parse(document.at_css("script#inkwell-data").content)
    expect(data.keys).to eq(%w[site navigation page posts authors comments pagination])
    expect(data.dig("site", "name")).to eq("Contract Site")
    expect(document.at_css("[data-inkwell-region='posts']")["data-inkwell-rendered"]).to eq("posts")
    expect(response.body).to include("A sample story")
  end

  it "resolves declared routes and dynamic post routes" do
    get "/blog"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Journal", "A sample story")

    get "/blog/a-sample-story"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("A sample story", "Hello from the contract.", "A thoughtful reply")
    expect(Nokogiri::HTML(response.body).at_css("link[rel='canonical']")["href"]).to include("/blog/a-sample-story")
  end

  it "returns 404 for a declared dynamic post route with no CMS record" do
    get "/blog/not-a-real-post"
    expect(response).to have_http_status(:not_found)
  end

  it "serves SPA deep links but never a missing asset" do
    get "/customers/123?tab=open"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Contract Site", '<base href="/">')

    get "/assets/missing.js"
    expect(response).to have_http_status(:not_found)
    expect(response.body).not_to include("Contract Site")
  end

  it "does not publish a draft route and applies published SEO overrides" do
    route = site.theme_routes.create!(path: "/about", route_key: "about", theme_release_id: theme_slug,
      title_override: "About", meta_description: "A route description", canonical_url: "https://www.example.com/about-us",
      status: "draft")

    get "/about"
    expect(response).to have_http_status(:not_found)

    route.publish!
    get "/about"
    expect(response).to have_http_status(:ok)
    document = Nokogiri::HTML(response.body)
    expect(document.at_css("title").text).to eq("About")
    expect(document.at_css("meta[name='description']")["content"]).to eq("A route description")
    expect(document.at_css("link[rel='canonical']")["href"]).to eq("https://www.example.com/about-us")

    get "/sitemap.xml"
    expect(response.body).to include("/about")
  end

  it "serves read-only islands with site scoping, pagination and ETags" do
    get "/theme-islands/comments", params: { post_id: post.id }
    expect(response).to have_http_status(:ok)
    payload = response.parsed_body
    expect(payload.dig("page", "id")).to eq(post.id.to_s)
    expect(payload["comments"].first["body"]).to eq("A thoughtful reply")
    expect(response.headers["ETag"]).to be_present
    expect(response.headers["Cache-Control"]).to include("public")

    other = Site.create!(name: "Other", domain: "other-contract.test")
    other_post = other.posts.create!(title: "Private", slug: "private", status: "published", published_at: Time.current, author: author, content: [])
    get "/theme-islands/comments", params: { post_id: other_post.id }
    expect(response).to have_http_status(:not_found)
  end

  it "keeps unknown regions harmless and validates malformed known regions" do
    theme_root.join("public/about.html").write(<<~HTML)
      <!doctype html><html><head></head><body>
        <div data-inkwell-region="hero">Custom hero</div>
        <div data-inkwell-region="posts" data-inkwell-query="drop table">Unsafe query</div>
      </body></html>
    HTML

    get "/about"
    expect(response).to have_http_status(:ok)
    document = Nokogiri::HTML(response.body)
    expect(document.at_css("[data-inkwell-region='hero']").text).to eq("Custom hero")
    expect(document.at_css("[data-inkwell-region='posts']").text).to include("Unsafe query")
    expect(document.at_css("[data-inkwell-region='posts']")["data-inkwell-rendered"]).to be_nil
  end

  it "renders declared parts and lets a site override them without touching the release" do
    get "/"
    document = Nokogiri::HTML(response.body)
    expect(document.at_css("[data-inkwell-part='header']")["data-inkwell-part-source"]).to eq("release")
    expect(document.at_css("[data-part-rendered]").text).to include("Contract Site")

    site.theme_part_overrides.create!(theme_release_id: theme_slug, part_key: "header", body: "<header data-override>Overridden</header>")
    get "/"
    document = Nokogiri::HTML(response.body)
    expect(document.at_css("[data-inkwell-part='header']")["data-inkwell-part-source"]).to eq("override")
    expect(document.at_css("[data-override]").text).to eq("Overridden")
  end

  it "supports explicit client hydration without losing the initial SEO payload" do
    data = JSON.parse(theme_root.join("theme.json").read)
    data["inkwell"]["runtime"] = "client_hydration"
    theme_root.join("theme.json").write(JSON.generate(data))
    site.set_setting!("tagline", "A deliberately indexed site")

    get "/"

    document = Nokogiri::HTML(response.body)
    expect(document.at_css("meta[name='inkwell-rendering']")["content"]).to eq("client")
    expect(document.at_css("[data-inkwell-region='posts']")["data-inkwell-rendered"]).to be_nil
    expect(document.at_css("script#inkwell-data")).to be_present
    expect(document.at_css("meta[name='description']")["content"]).to be_present
  end

  it "never serializes private account or model fields" do
    get "/"
    data = JSON.parse(Nokogiri::HTML(response.body).at_css("script#inkwell-data").content)
    author_keys = data.dig("posts", 0, "author").keys
    expect(author_keys).to match_array(ThemeRuntime::Contract::AUTHOR_KEYS)
    expect(author_keys).not_to include("email", "encrypted_password", "reset_password_token", "role_id")
    expect(data.dig("site").keys).to match_array(ThemeRuntime::Contract::SITE_KEYS.compact)
  end

  it "compares fixture and production documents through the same contract" do
    fixture = ThemeRuntime::Fixtures.new(theme_root, "inkwell/fixtures").load
    expect(fixture.keys).to eq(%w[site navigation page posts authors comments pagination])
    expect(fixture.dig("site", "id")).to eq("fixture-site")
    expect(fixture["posts"].first.keys).to eq(ThemeRuntime::Contract::PAGE_KEYS)

    get "/"
    production = JSON.parse(Nokogiri::HTML(response.body).at_css("script#inkwell-data").content)
    expect(production.keys).to eq(fixture.keys)
    expect(production["posts"].first.keys).to eq(fixture["posts"].first.keys)
  end
end
