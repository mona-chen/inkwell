require "rails_helper"

RSpec.describe "SEO draft review", type: :request do
  include Devise::Test::IntegrationHelpers
  let(:site) { Site.create!(name: "SEO", domain: "example.test") }
  let(:role) { Role.create!(name: "admin") }
  let(:user) { User.create!(name: "Editor", email: "seo-review@example.test", password: "password123", site: site, role: role) }
  before do
    sign_in user
    InstalledPlugin.find_or_create_by!(slug: "seo_toolkit") { |plugin| plugin.name = "SEO Toolkit"; plugin.version = "2.0.0" }.update!(active: true)
    Seo::Engine.instance.on_activate
  end
  after { Inkwell::Hooks.remove_source!("seo_toolkit") }

  it "renders complete accessible SEO tabs and a native modal command palette" do
    record = Post.create!(site: site, author: user, title: "Editing")
    get edit_admin_post_path(record)
    html = Nokogiri::HTML(response.body)
    workspace = html.at_css('[data-controller="seo-editor"]')
    expect(workspace).to be_present
    expect(workspace.css('[role="tab"]').map(&:text)).to eq(%w[Search Social Advanced])
    %w[descriptionSource metaDescription descriptionCount score wordCount recommendations readingRecommendations].each do |target|
      expect(workspace.at_css("[data-seo-editor-target='#{target}']")).to be_present
    end
    workspace.css('input:not([type="hidden"]), textarea, select').each do |field|
      expect(html.at_css("label[for='#{field['id']}']") || field.ancestors('label').first).to be_present
    end
    expect(html.at_css('dialog[data-command-palette-target="panel"]')).to be_present
  end

  it "analyzes unsaved rich text and metadata without persisting either" do
    record = Post.create!(site: site, author: user, title: "Original", content: [{ type: "paragraph", data: { text: "Live content" } }])
    doc = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Useful ideas" }] }, { type: "paragraph", content: [{ type: "text", text: "Good writing gives readers useful ideas.", marks: [{ type: "link", attrs: { href: "https://example.com" } }] }] }] }
    post "/plugins/seo_toolkit/analyze", params: { resource: "post", record_id: record.id, content: { title: "Draft title", seo_description: "", draft_content: [{ type: "rich_text", data: { json: doc.to_json } }].to_json } }, as: :json
    expect(response).to have_http_status(:ok)
    data = response.parsed_body
    expect(data["words"]).to eq(8)
    expect(data["description"]).to include("Good writing")
    expect(data["results"].find { |item| item["id"] == "description_length" }["message"]).to start_with("#{data['description'].length} characters")
    expect(data["results"].find { |item| item["id"] == "headings" }["message"]).to eq("1 subheading found.")
    expect(data["results"].find { |item| item["id"] == "links" }["message"]).to eq("1 link found.")
    expect(record.reload.title).to eq("Original")
    expect(record.draft_content).to be_nil
  end

  it "respects an intentionally empty draft instead of reviewing the live version" do
    record = Post.create!(site: site, author: user, title: "Original", content: [{ type: "paragraph", data: { text: "Live content" } }])
    post "/plugins/seo_toolkit/analyze", params: { resource: "post", record_id: record.id, content: { draft_content: "[]" } }, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to include("words" => 0, "description" => "", "readability" => 0)
  end

  it "does not analyze another site's content" do
    other = Site.create!(name: "Other", domain: "other.test")
    record = Post.create!(site: other, author: user, title: "Private")
    post "/plugins/seo_toolkit/analyze", params: { resource: "post", record_id: record.id, content: { title: "Test" } }, as: :json
    expect(response).to have_http_status(:not_found)
  end
end
