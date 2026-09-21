require "rails_helper"

RSpec.describe "Builder content-type templates", type: :request do
  let(:site) { Site.create!(name: "Tpl Site", domain: "tpl.test", active_theme: "default") }
  let(:role) { Role.create!(name: "admin") }
  let(:user) { User.create!(name: "Ada", email: "tpl@example.com", password: "password123", site: site, role: role) }

  def builder_page(title:, slug:, role_name:, raw_html:)
    page = site.pages.create!(title: title, slug: slug, status: "published", template: "default", author: user)
    converted = PageBuilder::ErbConverter.convert(raw_html, document_root: "@page")
    page.update!(
      template_for: role_name,
      content: [ { "type" => "page_builder", "data" => { "html" => converted, "store" => { "version" => 2, "type" => "page", "settings" => {}, "children" => [] } } } ]
    )
    page
  end

  let!(:post) do
    site.posts.create!(title: "Hello Template", slug: "hello-template", status: "published",
                       published_at: 1.minute.ago, excerpt: "A custom excerpt", author: user)
  end

  it "renders a single-post template in place of the theme" do
    builder_page(title: "Post Template", slug: "post-template", role_name: "single_post",
                 raw_html: "<article data-tpl='single'><h1>{{ page.title }}</h1><p>{{ post.excerpt }}</p></article>")

    get "/posts/hello-template"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("data-tpl='single'")
    expect(response.body).to include("Hello Template")
    expect(response.body).to include("A custom excerpt")
  end

  it "renders an archive template at the posts index" do
    builder_page(title: "Archive Template", slug: "archive-template", role_name: "archive",
                 raw_html: "<section data-tpl='archive'>{{ loop posts:5 }}<h2 class='card-title'>{{ post.title }}</h2>{{ /loop }}</section>")

    get "/posts"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("data-tpl='archive'")
    expect(response.body).to include("card-title")
    expect(response.body).to include("Hello Template")
  end

  it "falls back to the theme when no template is assigned" do
    get "/posts/hello-template"
    expect(response).to have_http_status(:ok)
    expect(response.body).not_to include("data-tpl='single'")
  end

  it "validates the template role" do
    page = site.pages.new(title: "X", template: "default", author: user, template_for: "nonsense")
    expect(page).not_to be_valid
  end

  it "renders an author profile with bound fields and only that author's published posts" do
    another = site.users.create!(name: "Other Author", email: "other-tpl@example.com", password: "password123", role: role)
    site.posts.create!(title: "Someone else's post", slug: "other-post", status: "published", published_at: 1.minute.ago, author: another)
    site.posts.create!(title: "Private draft", slug: "private-draft", status: "draft", author: user)
    builder_page(title: "Author Template", slug: "author-template", role_name: "single_author",
      raw_html: "<article data-tpl='author'><h1>{{ author.name }}</h1>{{ loop author_posts:9 }}<h2>{{ post.title }}</h2>{{ /loop }}</article>")

    get "/authors/#{user.to_param}"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("data-tpl='author'", "Ada", "Hello Template")
    expect(response.body).not_to include("Someone else's post", "Private draft")
  end
end
