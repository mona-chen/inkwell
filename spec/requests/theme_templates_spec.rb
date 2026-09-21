require "rails_helper"

# A theme is a self-contained view-path bundle: ThemeManager prepends its directory and Rails
# falls back to core `app/views` for anything the theme omits (shared partials like
# `site/nav`), never to another theme's templates. `mono` shipped no posts index, author
# archive or 404, so switching to it raised ActionView::MissingTemplate on those routes —
# these cover the templates that close that gap.
RSpec.describe "Theme templates", type: :request do
  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Mono Site", domain: "mono.test", is_default: true, active_theme: "mono") }
  let(:author) { User.create!(name: "Ada Lovelace", email: "ada@example.com", password: "password123", site: site, role: role) }

  before do
    allow(Current).to receive(:site).and_return(site)
    site.posts.create!(
      title: "Analytical engines",
      slug: "analytical-engines",
      status: "published",
      published_at: 1.hour.ago,
      author: author,
      content: [ { "type" => "paragraph", "data" => { "text" => "Notes on computation." } } ]
    )
  end

  it "renders the posts archive in the mono theme" do
    get "/posts"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Analytical engines")
  end

  it "renders a tag archive" do
    get "/tags/notes"

    expect(response).to have_http_status(:ok)
  end

  it "renders the author archive in the mono theme" do
    get "/authors/#{author.to_param}"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Ada Lovelace")
  end

  it "renders the theme's own 404" do
    get "/posts/no-such-post"

    expect(response).to have_http_status(:not_found)
    expect(response.body).to include("path not found")
  end
end
