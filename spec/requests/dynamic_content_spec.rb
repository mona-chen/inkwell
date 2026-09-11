require "rails_helper"

RSpec.describe "Dynamic content in builder pages", type: :request do
  let(:site) { Site.create!(name: "Dyn Site", domain: "dyn.test", active_theme: "default") }
  let(:role) { Role.create!(name: "admin") }
  let(:user) { User.create!(name: "Ada", email: "dyn@example.com", password: "password123", site: site, role: role) }

  it "resolves field and loop tokens to real content" do
    site.posts.create!(title: "First Post", slug: "first-post", status: "published", published_at: 1.minute.ago, author: user)
    site.posts.create!(title: "Second Post", slug: "second-post", status: "published", published_at: 1.minute.ago, author: user)

    page = site.pages.create!(title: "Blog", slug: "blog", status: "published", template: "default", author: user)
    raw_html = "<h1>{{ site.name }}</h1>{{ loop posts:2 }}<article><h2>{{ post.title }}</h2></article>{{ /loop }}"
    converted = PageBuilder::ErbConverter.convert(raw_html, document_root: "@page")
    page.update!(content: [ {
      "type" => "page_builder",
      "data" => {
        "html" => converted,
        "store" => { "version" => 2, "type" => "page", "settings" => { "title" => "Blog" }, "children" => [] }
      }
    } ])

    get "/pages/blog"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Dyn Site")
    expect(response.body).to include("First Post")
    expect(response.body).to include("Second Post")
  end

  it "exposes a data source catalog to the builder" do
    catalog = PageBuilder::DataSources.catalog
    expect(catalog["sources"]).to include("site", "post", "page")
    expect(catalog["loops"]).to include("posts")
  end

  it "provides the model methods the catalog references" do
    post = site.posts.create!(title: "T", slug: "t", status: "published", author: user)
    page = site.pages.create!(title: "P", slug: "p", author: user)

    expect(site.url).to end_with(site.public_host)
    expect(post.url).to eq("/posts/t")
    expect(page.url).to eq("/pages/p")
    expect(post.featured_image_url).to be_nil.or be_a(String)
  end
end
