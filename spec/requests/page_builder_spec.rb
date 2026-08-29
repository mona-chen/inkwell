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

  it "publishes the saved builder document and returns its public URL" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "publisher@example.com", password: "password123", site: site, role: role)
    page = site.pages.create!(title: "Launch", slug: "launch", status: "draft", template: "landing", author: user)
    page.update!(draft_content: [{ "type" => "paragraph", "data" => { "text" => "Stale draft" } }])
    sign_in user

    post "/builder/save", params: {
      record_type: "page", record_id: page.id, publish: true,
      html: "<main><h1>Ready</h1></main>",
      store: { version: 2, type: "page", settings: { title: "Launch" }, children: [] }
    }, as: :json

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to include("status" => "published", "public_url" => "/pages/launch")
    expect(page.reload.status).to eq("published")
    expect(page.draft_content).to be_nil
    expect(page.content_blocks.first.dig("data", "html")).to include("Ready")

    get "/pages/launch"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Ready")
    expect(response.body).not_to include('<header class="sticky')
  end

  it "keeps an imported original live while native Builder work remains independent" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "dual-track@example.com", password: "password123", site: site, role: role)
    page = site.pages.create!(
      title: "Imported", slug: "imported", status: "draft", template: "landing", author: user,
      original_import_url: "https://example.test/",
      original_import_html: "<html><head><base href=\"https://example.test/\"></head><body><main id=\"original\">Original source</main></body></html>"
    )
    page.update!(draft_content: [{ "type" => "page_builder", "data" => { "html" => "<main>Native work in progress</main>" } }])
    sign_in user

    post "/admin/pages/#{page.id}/publish_original_import"

    expect(response).to redirect_to(edit_admin_page_path(page))
    expect(page.reload).to have_attributes(status: "published", live_render_mode: "original_import")
    expect(page.draft_content.first.dig("data", "html")).to include("Native work in progress")

    get "/pages/imported"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Original source")
    expect(response.body).not_to include("Native work in progress")
  end

  it "shows a Visit page action for an already published record" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "visitor@example.com", password: "password123", site: site, role: role)
    page = site.pages.create!(title: "Public", slug: "public", status: "published", template: "landing", author: user)
    sign_in user

    get "/builder/page/#{page.id}"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include('id="visitPageButton"')
    expect(response.body).to include('var publicPageUrl = "/pages/public"')
  end

  it "privately previews a draft through its real page template" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "previewer@example.com", password: "password123", site: site, role: role)
    page = site.pages.create!(title: "Private Preview", slug: "private-preview", status: "draft", template: "landing", author: user)
    page.update!(content: [{ "type" => "page_builder", "data" => { "html" => "<main><h1>Draft rendered privately</h1></main>" } }])

    get "/pages/private-preview"
    expect(response).to have_http_status(:not_found)

    sign_in user
    get "/builder/page/#{page.id}/preview"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Draft rendered privately")
    expect(response.body).not_to include("ink-appbar")
    expect(response.body).not_to include('<header class="sticky')
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

  it "binds a captured background image layer to its owning native container" do
    imported = {
      "type" => "container",
      "settings" => { "importedLabel" => "Hero" },
      "children" => [{
        "type" => "container",
        "settings" => { "importedLabel" => "Background Image" },
        "children" => [{
          "type" => "image",
          "settings" => { "src" => "https://example.test/hero.webp", "importedAttributes" => { "src" => "https://example.test/hero.webp" } }
        }]
      }]
    }

    materialized = PageBuilder::BuilderController.new.send(:materialize_import_node, imported)
    image = materialized.dig("children", 0, "children", 0)

    expect(materialized.dig("settings", "importedBackgroundImageId")).to eq(image.fetch("id"))
  end

  it "updates one shared template part without erasing the site's other global parts" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "parts@example.com", password: "password123", site: site, role: role)
    page = site.pages.create!(title: "About", template: "landing", author: user)
    site.set_builder_site_parts!({
      "header" => { "id" => "global-header", "type" => "site-part", "settings" => { "partKey" => "header" }, "children" => [] },
      "footer" => { "id" => "global-footer", "type" => "site-part", "settings" => { "partKey" => "footer" }, "children" => [] }
    })
    sign_in user

    post "/builder/save", params: {
      record_type: "page", record_id: page.id, html: "<main>About</main>",
      store: { version: 2, type: "page", settings: { title: "About" }, children: [] },
      site_parts: {
        header: { id: "global-header", type: "site-part", settings: { partKey: "header", label: "Updated header" }, children: [] }
      }
    }, as: :json

    expect(response).to have_http_status(:ok)
    expect(site.reload.builder_site_parts.keys).to contain_exactly("header", "footer")
    expect(site.builder_site_parts.dig("header", "settings", "label")).to eq("Updated header")
    expect(site.builder_site_parts.dig("footer", "id")).to eq("global-footer")
  end

  it "renders an imported native page immediately without requiring a builder save" do
    site = Site.create!(name: "S", domain: "s.test")
    role = Role.create!(name: "admin")
    user = User.create!(name: "A", email: "importer@example.com", password: "password123", site: site, role: role)
    capture_id = "spec-native-import"
    capture_dir = Rails.root.join("tmp", "site-captures", capture_id)
    FileUtils.mkdir_p(capture_dir)
    File.write(capture_dir.join("site-builder-payload.json"), JSON.generate({
      format: "ink-builder-site-import-v1",
      pages: [{
        source: "https://example.test/", title: "Imported", slug: "imported-home", depth: 0,
        payload: {
          settings: { importMode: "native-lossless" },
          children: [{ type: "heading", settings: { text: "Editable heading" }, children: [] }],
          initialHtml: '<main><h1>Immediate render</h1><a href="/pages/imported-home">Home</a></main>',
          customCss: "main { color: rebeccapurple; }", customJs: "document.documentElement.dataset.imported = 'yes'"
        }
      }],
      siteParts: {}, importReport: { mappedPages: 1 }
    }))
    sign_in user

    post "/builder/workspace/captures/#{capture_id}/import", as: :json

    expect(response).to have_http_status(:ok)
    imported = site.pages.find(response.parsed_body.dig("pages", 0, "id"))
    block = imported.content_blocks.find { |candidate| candidate["type"] == "page_builder" }
    expect(block.dig("data", "html")).to include("Immediate render")
    expect(block.dig("data", "store", "children", 0, "type")).to eq("heading")
    expect(block.dig("data", "custom_css")).to include("rebeccapurple")
    expect(block.dig("data", "custom_js")).to include("dataset.imported")

    get "/builder/page/#{imported.id}/preview"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Immediate render")
  ensure
    FileUtils.rm_rf(capture_dir) if capture_dir
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
