require "rails_helper"

RSpec.describe "Preserved imported pages", type: :request do
  let!(:site) { Site.create!(name: "Imported", domain: "www.example.com", active_theme: "default") }
  let(:role) { Role.create!(name: "admin") }
  let(:user) { User.create!(name: "Owner", email: "preserved@example.com", password: "password123", site: site, role: role) }

  def imported(path, **attributes)
    Page.create!({ site: site, title: "Imported page", author: user, template: "landing", status: "published",
      public_path: path, original_import_url: "https://source.test#{path}", live_render_mode: "original_import",
      original_import_html: '<!doctype html><html><head><title>Old title</title><meta name="description" content="Old description"><link rel="canonical" href="https://source.test/old"><script type="module" src="https://cdn.test/runtime.js"></script></head><body><div id="root" data-framer-name="Hero">Original DOM</div><a href="https://source.test/blogs/article?ref=card#read">Read</a><script>window.motion = true;</script></body></html>' }.merge(attributes))
  end

  it "preserves runtime and DOM while owning SEO and local navigation" do
    article = imported("/blogs/article", title: "Article")
    page = imported("/pricing.html", seo_title: "New SEO title", seo_description: "New description")
    get "/pricing.html"
    expect(response).to have_http_status(:ok)
    doc = Nokogiri::HTML5.parse(response.body)
    expect(doc.at_css("title").text).to eq("New SEO title")
    expect(doc.css("meta[name='description']").map { |n| n['content'] }).to eq(["New description"])
    expect(doc.at_css("link[rel='canonical']")['href']).to eq("https://www.example.com/pricing.html")
    expect(doc.at_css("#root")['data-framer-name']).to eq("Hero")
    expect(doc.at_css("script[type='module']")['src']).to eq("https://cdn.test/runtime.js")
    expect(response.body).to include("window.motion = true;")
    expect(doc.at_css("a")['href']).to eq("http://www.example.com/blogs/article?ref=card#read")
    expect(doc.at_css("base")['href']).to eq(page.original_import_url)
  end

  it "uses the same rendering at the root and legacy page URL" do
    page = imported("/", title: "Home")
    get "/"
    expect(response.body).to include("Original DOM", "window.motion = true;")
    get "/pages/#{page.slug}"
    expect(response.body).to include("Original DOM")
  end

  it "does not expose drafts or another site's paths" do
    imported("/draft", status: "draft")
    get "/draft"
    expect(response).to have_http_status(:not_found)
    other = Site.create!(name: "Other", domain: "other.test")
    imported("/private", site: other)
    get "/private"
    expect(response).to have_http_status(:not_found)
  end

  it "rejects conflicting paths within one site" do
    imported("/same")
    expect { imported("/same", title: "Duplicate") }.to raise_error(ActiveRecord::RecordInvalid)
  end
  it "hides the Framer host badge without removing the original runtime or branded page content" do
    page = imported("/badge-example", original_import_html: '<html><head><script type="module" src="https://cdn.test/runtime.js"></script></head><body><main>Original Framer article</main><div id="__framer-badge-container"><a>Made in Framer</a></div></body></html>')
    site.set_setting!("custom_css", "#__framer-badge-container { display: none !important; }")
    get "/badge-example"
    expect(response).to have_http_status(:ok)
    document = Nokogiri::HTML5.parse(response.body)
    expect(document.at_css("style[data-ink-site-custom-css]").text).to include("#__framer-badge-container", "display: none !important")
    expect(document.at_css("#__framer-badge-container")).to be_present
    expect(document.at_css('script[type="module"]')['src']).to eq("https://cdn.test/runtime.js")
    expect(document.at_css("main").text).to eq("Original Framer article")
    expect(page.reload.original_import_html).not_to include("data-ink-site-custom-css")
  end

end
