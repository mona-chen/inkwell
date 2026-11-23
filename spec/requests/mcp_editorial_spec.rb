require "rails_helper"

RSpec.describe "MCP editorial publishing", type: :request do
  let!(:site) { Site.create!(name: "Agent site", domain: "agents.test", is_default: true, active_theme: "default") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:owner) { User.create!(name: "Owner", email: "editorial-owner@test.example", password: "password123", role: role, site: site) }
  let!(:secret) { AgentCredential.issue!(site: site, user: owner, name: "Writer", scopes: AgentCredential::SCOPES).last }
  let(:headers) { { "Authorization" => "Bearer #{secret}", "Accept" => "application/json, text/event-stream", "Content-Type" => "application/json" } }

  def tool(name, args = {})
    post "/mcp", params: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: name, arguments: args } }.to_json, headers: headers
    JSON.parse(response.body).fetch("result")
  end

  def result(name, args = {})
    payload = tool(name, args)
    expect(payload["isError"]).to eq(false), payload.inspect
    payload.fetch("structuredContent")
  end

  let(:blocks) do
    [
      { type: "takeaways", data: { items: [ "Ruut lists **TikTok**", "Intercom lists Slack" ] } },
      { type: "heading", data: { level: 2, text: "At a glance" } },
      { type: "table", data: { caption: "Ruut vs Intercom", columns: [ "Feature", "Ruut", "Intercom" ], highlight: 1, rows: [ [ "Shared inbox", "✓", "✓" ], [ "TikTok", "✓", "✗" ] ], note: "Checked 23 November 2026." } },
      { type: "heading", data: { level: 2, text: "Pricing" } },
      { type: "paragraph", data: { text: "See [pricing](/pricing) and [Intercom](https://www.intercom.com/pricing)." } },
      { type: "faq", data: { items: [ { question: "Is Ruut an Intercom alternative?", answer: "Yes, for messaging-led teams." } ] } }
    ]
  end

  it "guides, drafts typed blocks, sets taxonomy and SEO, audits and publishes" do
    guide = result("inkwell.content_guide")
    expect(guide["blocks"].map { |block| block["type"] }).to include("table", "faq", "takeaways", "stats", "cta", "embed")
    expect(guide.dig("editorial", "workflow")).to be_present

    created = result("inkwell.content_create", kind: "post", title: "Ruut vs Intercom", slug: "ruut-vs-intercom", excerpt: "An honest comparison.")
    expect(created["slug"]).to eq("ruut-vs-intercom")

    saved = result("inkwell.content_save_draft", kind: "post", id: created["id"], version: created["version"], blocks: blocks)
    meta = result("inkwell.content_update_metadata", kind: "post", id: created["id"], version: saved["version"], values: { seo_title: "Ruut vs Intercom (2026): Features, AI and Pricing", categories: [ "Comparisons" ], tags: [ "Intercom", "WhatsApp" ], cornerstone: true })
    expect(meta["categories"].map { |term| term["name"] }).to eq([ "Comparisons" ])
    expect(meta["tags"].map { |term| term["name"] }).to contain_exactly("Intercom", "WhatsApp")
    expect(meta["seo_checks"].find { |check| check["id"] == "category" }["ok"]).to be(true)
    expect(meta["seo_checks"].find { |check| check["id"] == "featured_image" }["ok"]).to be(false)

    result("inkwell.content_publish", kind: "post", id: created["id"], version: meta["version"])
    post_record = Post.find(created["id"])
    expect(post_record.status).to eq("published")
    expect(post_record.content.map { |block| block["type"] }).to include("table", "faq")
    expect(result("inkwell.terms_list")["categories"].first).to include("name" => "Comparisons", "posts" => 1)

    payload = ThemeRuntime::Serializer.new(site: site, paths: { "post" => "/blog/:slug" }).post_payload(post_record)
    expect(payload["url"]).to eq("/blog/ruut-vs-intercom")
    expect(payload["html"]).to include('<figure class="ink-table"', 'class="is-highlighted"', 'ink-mark--yes', '<section class="ink-faq">', '<a href="/pricing">pricing</a>')
    expect(payload["toc"].map { |entry| entry["id"] }).to eq(%w[at-a-glance pricing frequently-asked-questions])
    graph = payload.dig("seo", "schema", "@graph")
    expect(graph.map { |node| node["@type"] }).to eq(%w[Article BreadcrumbList FAQPage])
    expect(payload["category"]["name"]).to eq("Comparisons")
    expect(payload["featured"]).to be(true)
  end

  it "explains exactly which block field is invalid" do
    created = result("inkwell.content_create", kind: "post", title: "Bad table")
    payload = tool("inkwell.content_save_draft", kind: "post", id: created["id"], version: created["version"], blocks: [ { type: "table", data: { columns: [ "A" ] } } ])
    expect(payload["isError"]).to be(true)
    expect(payload.dig("content", 0, "text")).to include("/blocks/0/data")
  end

  it "schedules a post and publishes its draft when the time comes" do
    created = result("inkwell.content_create", kind: "post", title: "Scheduled story")
    saved = result("inkwell.content_save_draft", kind: "post", id: created["id"], version: created["version"], blocks: [ { type: "paragraph", data: { text: "Hello" } } ])
    result("inkwell.content_publish", kind: "post", id: created["id"], version: saved["version"], publish_at: 1.hour.from_now.iso8601)
    record = Post.find(created["id"])
    expect(record.status).to eq("scheduled")
    record.update_columns(scheduled_for: 1.minute.ago)
    PublishScheduledPostsJob.perform_now
    expect(record.reload.status).to eq("published")
    expect(record.content).to eq([ { "type" => "paragraph", "data" => { "text" => "Hello" } } ])
  end

  it "updates author profiles with an avatar and safe links" do
    image = site.media_items.new(uploaded_by: owner, alt_text: "Owner")
    image.file.attach(io: StringIO.new(Base64.decode64("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")), filename: "a.png", content_type: "image/png")
    image.save!
    profile = result("inkwell.profile_update", name: "Ada Obi", job_title: "Head of Support", bio: "Writes about support.", avatar_media_id: image.id, links: [ { url: "linkedin.com/in/ada" }, { url: "https://x.com/ada" } ])
    expect(profile["links"].map { |link| link["kind"] }).to eq(%w[linkedin x])
    expect(profile["links"].first["url"]).to eq("https://linkedin.com/in/ada")
    expect(owner.reload.avatar_display_url).to be_present

    bad = tool("inkwell.profile_update", links: [ { url: "javascript:alert(1)" } ])
    expect(bad["isError"]).to be(true)

    author = ThemeRuntime::Serializer.new(site: site).author_payload(owner)
    expect(author).to include("title" => "Head of Support", "bio" => "Writes about support.")
  end
end
