require "rails_helper"

RSpec.describe "Page builder ↔ block editor", type: :request do
  include Devise::Test::IntegrationHelpers

  it "expands {{ blocks }} into a render_block_content call" do
    erb = PageBuilder::ErbConverter.convert('<div>{{ blocks }}</div>', document_root: "@page")
    expect(erb).to include('<div><%= render_block_content(@page) %></div>')
  end

  it "persists custom_css and custom_js alongside the builder HTML" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "a@example.com", password: "password123", site: site, role: role)
    page = site.pages.create!(title: "About", template: "default", author: user)
    sign_in user

    post "/builder/save", params: {
      record_type: "page", record_id: page.id,
      html: "<html><body><p>new</p></body></html>",
      store: {
        version: 2, type: "page", settings: { title: "About" },
        children: [{ id: "heading-1", type: "heading", settings: { text: "New" }, styles: { base: { color: "#123456" } } }]
      },
      custom_css: ".a { color: blue }",
      custom_js: "console.log(1)"
    }, as: :json

    expect(response).to have_http_status(:ok)
    block = page.reload.content_blocks.find { |b| b["type"] == "page_builder" }
    expect(block["data"]["html"]).to include("<p>new</p>")
    expect(block.dig("data", "store", "version")).to eq(2)
    expect(block.dig("data", "store", "children", 0, "type")).to eq("heading")
    expect(block["data"]["custom_css"]).to eq(".a { color: blue }")
    expect(block["data"]["custom_js"]).to eq("console.log(1)")
  end

  it "renders a record's blocks (excluding the page_builder block) via BlockRenderer" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "a@example.com", password: "password123", site: site, role: role)
    page = site.pages.create!(title: "About", template: "default", author: user)
    page.content = [
      { "type" => "heading", "data" => { "level" => 2, "text" => "Hello" } },
      { "type" => "page_builder", "data" => { "html" => "<p>builder</p>" } }
    ]
    page.save!

    view = ActionView::Base.empty rescue nil
    # Render through a tiny helper instance via an anonymous controller view context.
    controller = ApplicationController.new
    controller.request = ActionDispatch::TestRequest.create
    controller.response = ActionDispatch::TestResponse.new
    html = controller.view_context.render(inline: "<%= render_block_content(page) %>", type: :erb, locals: { page: page })

    expect(html).to include("<h2")
    expect(html).to include("Hello")
    expect(html).not_to include("builder")
  end

  it "styles the Ink Builder block preview in the classic editor with the design system + page tokens" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "a@example.com", password: "password123", site: site, role: role)
    page = site.pages.create!(title: "About", template: "default", author: user)
    page.content = [
      { "type" => "page_builder", "data" => {
        "html" => "<html><body><section class=\"cp-section\"><h1 class=\"cp-title\">Hi</h1></section></body></html>",
        "custom_css" => ":root { --cp-accent: #5e6ad2; }"
      } }
    ]
    page.save!
    sign_in user

    get "/admin/pages/#{page.id}/edit"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("ink-design-kit.css") # the builder's design vocabulary is linked so the sandboxed preview renders styled
    expect(response.body).to include("--cp-accent: #5e6ad2")
    expect(response.body).to include("cp-title")
  end

  it "exposes the saved body so the builder canvas can show an existing HTML-only design" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "a@example.com", password: "password123", site: site, role: role)
    page = site.pages.create!(title: "About", template: "default", author: user)
    page.content = [
      { "type" => "page_builder", "data" => {
        "html" => "<html><head></head><body><h1 class=\"cp-title\">Existing design</h1></body></html>",
        "store" => { "name" => "PageElement", "theme" => "1_Column_Layout", "elementLists" => [] }
      } }
    ]
    page.save!
    sign_in user

    get "/builder/page/#{page.id}"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("var savedHtmlBody")
    expect(response.body).to include("Existing design")
  end

  it "prefers real content over a stale empty builder draft so the classic editor isn't blank" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "a@example.com", password: "password123", site: site, role: role)
    page = site.pages.create!(title: "About", template: "default", author: user)
    page.content = [
      { "type" => "page_builder", "data" => { "html" => "<p class=\"cp-title\">Real design</p>" } }
    ]
    page.save!
    page.update!(draft_content: [ { "type" => "page_builder", "data" => { "html" => "" } } ])

    expect(page.stale_builder_draft?(page.draft_content)).to be true
    expect(page.editing_blocks.first["data"]["html"]).to include("Real design")

    # A draft that actually has content is still respected.
    page.update!(draft_content: [ { "type" => "page_builder", "data" => { "html" => "<p>WIP</p>" } } ])
    expect(page.editing_blocks.first["data"]["html"]).to include("WIP")
  end

  it "starts a clean v2 document instead of reconstructing the legacy HTML model" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "a@example.com", password: "password123", site: site, role: role)
    page = site.pages.create!(title: "About", template: "default", author: user)
    page.content = [
      { "type" => "page_builder", "data" => {
        "html" => "<html><head></head><body><section class=\"cp-section\" style=\"background:#0f172a\"><div class=\"cp-container\"><p class=\"cp-eyebrow\">FEATURES</p><h1 class=\"cp-title\">Why teams choose us</h1><div class=\"cp-actions\"><a href=\"#\" class=\"cp-btn cp-btn-primary\">Get started</a></div></div></section></body></html>",
        "store" => { "name" => "PageElement", "theme" => "1_Column_Layout", "elementLists" => [] }
      } }
    ]
    page.save!
    sign_in user

    get "/builder/page/#{page.id}"

    expect(response).to have_http_status(:ok)
    # V1 email-builder stores are intentionally not reconstructed. The new builder owns a
    # recursive v2 document and starts clean when a page only has legacy HTML/store data.
    expect(response.body).to include("new InkBuilderV2")
    expect(response.body).to include("savedStore && savedStore.version === 2")
    expect(response.body).to include("var savedStore = {};")
    expect(response.body).to include("Why teams choose us")
  end
end
