require "rails_helper"

RSpec.describe "Builder collaboration", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Team", domain: "team.test") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:user) { User.create!(name: "Alex", email: "team-alex@example.com", password: "password123", site: site, role: role) }
  let!(:other) { User.create!(name: "Sam", email: "team-sam@example.com", password: "password123", site: site, role: role) }
  let!(:page) { site.pages.create!(title: "Team page", author: user, template: "default") }
  let(:state) { { "nodes" => { "frame-1" => { "id" => "frame-1", "type" => "frame", "settings" => {}, "styles" => { "desktop" => { "base" => { "color" => "red", "opacity" => 1 } } }, "children" => [] } }, "roots" => ["frame-1"], "settings" => {}, "customCss" => "", "customJs" => "" } }
  let(:room) { PageBuilder::Workspace.find_by!(record_type: "Page", record_id: page.id) }
  def sync(client, **extra)
    post "/builder/workspace/sync", params: { record_type: "page", record_id: page.id, client_id: client, initial: state, **extra }, as: :json
  end
  def change(name, before, after)
    { path: ["nodes", "frame-1", "styles", "desktop", "base", name], existed: true, before: before, value: after }
  end
  before { sign_in user }

  it "merges two editors' independent properties without publishing the page" do
    sync("editor-alex-000001")
    expect(response).to have_http_status(:ok)
    sync("editor-alex-000001", operations: [change("color", "red", "blue")])
    sign_in other
    sync("editor-sam-0000001", operations: [change("opacity", 1, 0.5)])
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig("document", "nodes", "frame-1", "styles", "desktop", "base")).to eq("color" => "blue", "opacity" => 0.5)
    expect(response.parsed_body["participants"].size).to eq(2)
    expect(page.reload.content_blocks).to be_empty
    expect(page.status).to eq("draft")
  end

  it "rejects a stale property atomically and permits an idempotent retry" do
    sync("editor-alex-000001", operations: [change("color", "red", "blue")])
    sync("editor-sam-0000001", operations: [change("color", "red", "green"), change("opacity", 1, 0.5)])
    expect(response).to have_http_status(:conflict)
    expect(room.document.dig("nodes", "frame-1", "styles", "desktop", "base")).to eq("color" => "blue", "opacity" => 1)
    sync("editor-alex-000001", operations: [change("color", "red", "blue")])
    expect(response).to have_http_status(:ok)
    expect(room.reload.revision).to eq(1)
  end

  it "persists layer comments, replies, and resolved states across editor sessions" do
    sync("editor-alex-000001")
    args = { record_type: "page", record_id: page.id }
    post "/builder/workspace/comment", params: args.merge(operation: "create", anchor: "frame-1", text: "Please check the spacing."), as: :json
    expect(response).to have_http_status(:ok)
    id = response.parsed_body["threads"].first["id"]
    sign_in other
    post "/builder/workspace/comment", params: args.merge(operation: "reply", thread_id: id, text: "Adjusted."), as: :json
    expect(response.parsed_body["threads"].first["messages"].map { |message| message["author"] }).to eq(%w[Alex Sam])
    post "/builder/workspace/comment", params: args.merge(operation: "resolve", thread_id: id), as: :json
    expect(room.reload.threads.first["resolved"]).to eq(true)
    post "/builder/workspace/comment", params: args.merge(operation: "reopen", thread_id: id), as: :json
    expect(room.reload.threads.first["resolved"]).to eq(false)
  end

  it "rejects a cyclic shared tree" do
    bad = state.deep_dup
    bad["nodes"]["frame-1"]["children"] = ["frame-1"]
    sync("editor-alex-000001", initial: bad)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(room.document).to eq({})
  end

  it "prevents a stale save from overwriting the shared draft" do
    sync("editor-alex-000001", operations: [change("color", "red", "blue")])
    post "/builder/save", params: { record_type: "page", record_id: page.id, collaboration_revision: 0, html: "stale", store: { version: 2, children: [] } }, as: :json
    expect(response).to have_http_status(:conflict)
    expect(page.reload.content_blocks).to be_empty
  end

  it "does not allow editors from another site to read this workspace" do
    sync("editor-alex-000001")
    foreign_site = Site.create!(name: "Other", domain: "other-team.test")
    outsider = User.create!(name: "Outside", email: "outside-team@example.com", password: "password123", site: foreign_site, role: role)
    sign_in outsider
    sync("editor-outsider-001")
    expect(response).to have_http_status(:forbidden).or have_http_status(:not_found)
  end
end
