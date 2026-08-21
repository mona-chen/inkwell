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
      custom_css: ".a { color: blue }",
      custom_js: "console.log(1)"
    }, as: :json

    expect(response).to have_http_status(:ok)
    block = page.reload.content_blocks.find { |b| b["type"] == "page_builder" }
    expect(block["data"]["html"]).to include("<p>new</p>")
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
end
