require "rails_helper"

RSpec.describe "Unified site MCP", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Agent site", domain: "agents.test", is_default: true, active_theme: "default") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:owner) { User.create!(name: "Owner", email: "agent-owner@test.example", password: "password123", role: role, site: site) }
  let!(:credential_pair) { AgentCredential.issue!(site: site, user: owner, name: "Test agent", scopes: AgentCredential::SCOPES) }
  let(:credential) { credential_pair.first }
  let(:secret) { credential_pair.last }
  let(:headers) { { "Authorization" => "Bearer #{secret}", "Accept" => "application/json, text/event-stream", "MCP-Protocol-Version" => "2025-11-25" } }

  def rpc(method, params = {}, extra_headers = {})
    post "/mcp", params: { jsonrpc: "2.0", id: 1, method: method, params: params }.to_json, headers: headers.merge("Content-Type" => "application/json").merge(extra_headers)
    JSON.parse(response.body) if response.body.present?
  end

  def tool(name, args = {})
    rpc("tools/call", { name: name, arguments: args }).fetch("result")
  end

  def result(name, args = {})
    payload = tool(name, args)
    expect(payload["isError"]).to eq(false), payload.inspect
    payload.fetch("structuredContent")
  end

  it "negotiates JSON transport and lists tools with schemas" do
    expect(rpc("initialize", { protocolVersion: "2025-11-25" }).dig("result", "protocolVersion")).to eq("2025-11-25")
    tools = rpc("tools/list").dig("result", "tools")
    expect(tools.map { |entry| entry["name"] }).to include("inkwell.content_create", "inkwell.plugin_stage")
    expect(tools.first["inputSchema"]["type"]).to eq("object")
    get "/mcp", headers: headers
    expect(response).to have_http_status(:method_not_allowed)
  end

  it "stores only credential hashes and never accepts legacy API tokens or cookies" do
    expect(credential.token_digest).not_to include(secret)
    sign_in owner
    legacy = site.api_tokens.create!(name: "Old frontend")
    rpc("tools/list", {}, "Authorization" => "Bearer #{legacy.token}")
    expect(response).to have_http_status(:unauthorized)
    rpc("tools/list", {}, "Authorization" => "")
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects revoked, expired and deactivated-user credentials" do
    credential.update!(revoked_at: Time.current)
    rpc("tools/list")
    expect(response).to have_http_status(:unauthorized)
    credential.update!(revoked_at: nil, expires_at: 1.second.ago)
    rpc("tools/list")
    expect(response).to have_http_status(:unauthorized)
    credential.update!(expires_at: 1.day.from_now)
    owner.deactivate!
    rpc("tools/list")
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects foreign browser origins and unsupported versions" do
    rpc("tools/list", {}, "Origin" => "https://other.example")
    expect(response).to have_http_status(:forbidden)
    rpc("tools/list", {}, "MCP-Protocol-Version" => "1900-01-01")
    expect(response).to have_http_status(:bad_request)
  end

  it "does not execute tools sent as notifications" do
    post "/mcp", params: { jsonrpc: "2.0", method: "tools/call", params: { name: "inkwell.content_create", arguments: { kind: "page", title: "Never" } } }.to_json, headers: headers.merge("Content-Type" => "application/json")
    expect(response).to have_http_status(:accepted)
    expect(site.pages.count).to eq(0)
  end

  it "enforces scopes for listing and direct invocation" do
    credential.update!(scopes: ["site:read"])
    expect(rpc("tools/list").dig("result", "tools").map { |entry| entry["name"] }).not_to include("inkwell.content_create")
    expect(tool("inkwell.content_create", kind: "page", title: "Denied")["isError"]).to eq(true)
    expect(site.pages.count).to eq(0)
  end

  it "enforces site isolation for tokens and records" do
    other = Site.create!(name: "Other", domain: "other.example")
    page = other.pages.create!(title: "Private", author: owner, status: "draft")
    expect(tool("inkwell.content_read", kind: "page", id: page.id)["isError"]).to eq(true)
    foreign_pair = AgentCredential.issue!(site: other, user: owner, name: "Other", scopes: ["site:read"])
    rpc("tools/list", {}, "Authorization" => "Bearer #{foreign_pair.last}")
    expect(response).to have_http_status(:unauthorized)
  end

  it "creates, drafts, restores and explicitly publishes without erasing live content" do
    created = result("inkwell.content_create", kind: "page", title: "New idea")
    page = site.pages.find(created["id"])
    saved = result("inkwell.content_save_draft", kind: "page", id: page.id, version: created["version"], blocks: [{ type: "paragraph", data: { text: "Draft" } }])
    expect(page.reload.content).to eq([])
    restored = result("inkwell.content_restore_draft", activity_id: saved["activity_id"])
    expect(page.reload.draft_content).to be_nil
    saved = result("inkwell.content_save_draft", kind: "page", id: page.id, version: restored["version"], blocks: [{ type: "paragraph", data: { text: "Final" } }])
    published = result("inkwell.content_publish", kind: "page", id: page.id, version: saved["version"])
    expect(page.reload.status).to eq("published")
    expect(page.content.first.dig("data", "text")).to eq("Final")
    result("inkwell.content_publish", kind: "page", id: page.id, version: published["version"])
    expect(page.reload.content.first.dig("data", "text")).to eq("Final")
    expect(site.agent_activities.where(status: "success").count).to be >= 6
  end

  it "rejects stale edits, malformed arguments, and builder block replacement" do
    page = site.pages.create!(title: "Original", author: owner, content: [])
    expect(tool("inkwell.content_save_draft", kind: "page", id: page.id, version: "stale", blocks: [])["isError"]).to eq(true)
    expect(tool("inkwell.content_save_draft", kind: "page", id: page.id, version: page.updated_at.iso8601(6), blocks: [{ type: "page_builder", data: { html: "opaque" } }])["isError"]).to eq(true)
    expect(tool("inkwell.content_read", kind: "page", id: page.id.to_s)["isError"]).to eq(true)
    expect(page.reload.draft_content).to be_nil
  end

  it "discovers only active plugin tools and invokes handlers through the shared context" do
    engine = PageBuilder::Engine
    record = InstalledPlugin.find_or_create_by!(slug: "page_builder") { |p| p.name = "Builder" }
    record.update!(active: true)
    expect(rpc("tools/list").dig("result", "tools").map { |entry| entry["name"] }).to include("page_builder.workspace_read")
    page = site.pages.create!(title: "Design", author: owner, content: [])
    read = result("page_builder.workspace_read", kind: "page", id: page.id)
    expect(read["document"]["roots"]).to eq([])
    changed = result("page_builder.workspace_patch", kind: "page", id: page.id, revision: read["revision"], operations: [{ path: ["settings", "title"], existed: true, before: "Design", value: "Draft design" }])
    expect(changed["document"]["settings"]["title"]).to eq("Draft design")
    expect(page.reload.content).to eq([])
    expect(tool("inkwell.content_publish", kind: "page", id: page.id, version: page.updated_at.iso8601(6))["isError"]).to eq(true)
    record.update!(active: false)
    expect(rpc("tools/list").dig("result", "tools").map { |entry| entry["name"] }).not_to include("page_builder.workspace_read")
  end

  it "honors per-site plugin deactivation" do
    record = InstalledPlugin.find_or_create_by!(slug: "page_builder") { |p| p.name = "Builder" }
    record.update!(active: true)
    site.plugin_activations.create!(installed_plugin: record, active: false)
    expect(rpc("tools/list").dig("result", "tools").map { |entry| entry["name"] }).not_to include("page_builder.workspace_read")
    expect(tool("page_builder.workspace_read", kind: "page", id: 1)["isError"]).to eq(true)
  end

  it "stages, activates, discovers live settings tools, updates and rolls back a plugin" do
    manifest = { name: "Banner", version: "1.0", css: ".banner { color: red; }", javascript: "window.banner = plugin.settings.message;", settings: { message: { type: "string", default: "Hello" } } }
    staged = result("inkwell.plugin_stage", slug: "banner", manifest: manifest)
    get "/"
    expect(response.body).not_to include('data-ink-live-plugin="banner"')
    activated = result("inkwell.plugin_activate", slug: "banner", release_id: staged["staged_release_id"], expected_active_release_id: nil)
    get "/"
    expect(response.body).to include('data-ink-live-plugin="banner"', "window.banner", '"message":"Hello"')
    config = result("live.banner.settings_read")
    result("live.banner.settings_update", values: { message: "Updated" }, expected_updated_at: config["updated_at"])
    get "/"
    expect(response.body).to include('"message":"Updated"')
    get "/users/sign_in"
    expect(response.body).not_to include('data-ink-live-plugin="banner"')
    v2 = result("inkwell.plugin_stage", slug: "banner", manifest: manifest.merge(version: "2.0"))
    result("inkwell.plugin_activate", slug: "banner", release_id: v2["staged_release_id"], expected_active_release_id: activated["active_release_id"])
    result("inkwell.plugin_activate", slug: "banner", release_id: staged["staged_release_id"], expected_active_release_id: v2["staged_release_id"])
    result("inkwell.plugin_activate", slug: "banner", release_id: nil, expected_active_release_id: staged["staged_release_id"])
    expect(rpc("tools/list").dig("result", "tools").map { |entry| entry["name"] }).not_to include("live.banner.settings_read")
  end

  it "rejects executable server packages and foreign plugin releases" do
    expect(tool("inkwell.plugin_stage", slug: "server", manifest: { name: "Bad", version: "1", ruby: "exec('command')" })["isError"]).to eq(true)
    other = Site.create!(name: "Other", domain: "other.example")
    foreign_plugin = other.live_plugins.create!(slug: "foreign")
    foreign_release = foreign_plugin.releases.create!(manifest: { name: "Foreign", version: "1" }, digest: "test")
    result("inkwell.plugin_stage", slug: "local", manifest: { name: "Local", version: "1" })
    expect(tool("inkwell.plugin_activate", slug: "local", release_id: foreign_release.id, expected_active_release_id: nil)["isError"]).to eq(true)
    expect(site.live_plugins.find_by!(slug: "local").active_release_id).to be_nil
  end

  it "provides credential controls in the admin UI and reveals the secret once" do
    sign_in owner
    get "/admin/settings?section=agents"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Agent connections", "/mcp", "plugins:deploy")
    post "/admin/agent_credentials", params: { name: "UI agent", scopes: ["site:read"] }
    follow_redirect!
    expect(response.body).to include("ink_agent_")
    get "/admin/settings?section=agents"
    expect(response.body).not_to include("Copy this secret now")
    created = site.agent_credentials.find_by!(name: "UI agent")
    delete "/admin/agent_credentials/#{created.id}"
    expect(created.reload.revoked_at).to be_present
  end
end

RSpec.describe "Agent deployment boundaries", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Boundaries", domain: "deploy.test", is_default: true, active_theme: "default") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:user) { User.create!(name: "Owner", email: "deploy@test.example", password: "password123", site: site, role: role) }
  let!(:pair) { AgentCredential.issue!(site: site, user: user, name: "Agent", scopes: AgentCredential::SCOPES) }

  def call_tool(name, args = {})
    result = AgentAccess::Registry.new(pair.first).call(name, args.deep_stringify_keys)
    result
  end

  it "guards metadata and settings changes and supports stale version detection" do
    page = site.pages.create!(author: user, title: "Live", status: "published")
    pair.first.update!(scopes: %w[site:read content:write])
    expect(call_tool("inkwell.content_update_metadata", kind: "page", id: page.id, version: page.updated_at.iso8601(6), values: { title: "Denied" })[:isError]).to eq(true)
    expect(page.reload.title).to eq("Live")
    pair.first.update!(scopes: AgentCredential::SCOPES)
    data = call_tool("inkwell.settings_read")[:structuredContent]
    expect(call_tool("inkwell.settings_update", revision: data[:revision], values: { custom_css: "body { color: red; }" })[:isError]).to eq(false)
    expect(call_tool("inkwell.settings_update", revision: data[:revision], values: { custom_css: "stale" })[:isError]).to eq(true)
    expect(site.setting("custom_css")).to eq("body { color: red; }")
  end

  it "lets an owner disable a live plugin through admin independently of agent credentials" do
    plugin = site.live_plugins.create!(slug: "test_plugin")
    release = plugin.releases.create!(manifest: { name: "Test", version: "1" }, digest: "test")
    plugin.update!(active_release: release)
    sign_in user
    get "/admin/settings?section=agents"
    expect(response.body).to include("Apply release", "Disabled")
    patch "/admin/live_plugins/#{plugin.id}", params: { release_id: "", expected_active_release_id: release.id }
    expect(plugin.reload.active_release_id).to be_nil
    expect(site.agent_activities.last.tool).to eq("admin.plugin_activate")
  end

  it "rejects stale activation without changing the current release" do
    staged = call_tool("inkwell.plugin_stage", slug: "versioned", manifest: { name: "Versioned", version: "1" })[:structuredContent]
    id = staged[:staged_release_id]
    expect(call_tool("inkwell.plugin_activate", slug: "versioned", release_id: id, expected_active_release_id: nil)[:isError]).to eq(false)
    expect(call_tool("inkwell.plugin_activate", slug: "versioned", release_id: nil, expected_active_release_id: nil)[:isError]).to eq(true)
    expect(site.live_plugins.find_by!(slug: "versioned").active_release_id).to eq(id)
  end

  it "restores workspace edits without replacing another editor's changes" do
    plugin = InstalledPlugin.find_or_create_by!(slug: "page_builder") { |p| p.name = "Builder" }
    plugin.update!(active: true)
    page = site.pages.create!(author: user, title: "Design", content: [])
    read = call_tool("page_builder.workspace_read", kind: "page", id: page.id)[:structuredContent]
    changed = call_tool("page_builder.workspace_patch", kind: "page", id: page.id, revision: read[:revision], operations: [{ path: ["settings", "title"], existed: true, before: "Design", value: "Changed" }])[:structuredContent]
    expect(call_tool("page_builder.workspace_restore", activity_id: changed[:activity_id])[:isError]).to eq(false)
    expect(call_tool("page_builder.workspace_restore", activity_id: changed[:activity_id])[:isError]).to eq(true)
  end

  it "preserves draft Builder payloads when publishing through MCP" do
    page = site.pages.create!(author: user, title: "Old", status: "published", content: [{ type: "page_builder", data: { html: "<p>Old</p>" } }], draft_content: [{ type: "page_builder", data: { html: "<p>New</p>", store: { version: 2, settings: { title: "New" }, children: [] }, custom_css: ".new{}" } }])
    expect(call_tool("inkwell.content_publish", kind: "page", id: page.id, version: page.updated_at.iso8601(6))[:isError]).to eq(false)
    expect(page.reload.content_blocks.first.dig("data", "html")).to include("New")
    expect(page.content_blocks.first.dig("data", "store", "version")).to eq(2)
    expect(page.title).to eq("New")
  end

  it "removes an active live plugin and its releases cleanly when the site is removed" do
    plugin = site.live_plugins.create!(slug: "removable")
    release = plugin.releases.create!(manifest: { name: "Test", version: "1" }, digest: "test")
    plugin.update!(active_release: release)
    expect { plugin.destroy! }.to change(LivePluginRelease, :count).by(-1)
  end
end
