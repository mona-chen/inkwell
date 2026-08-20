require "rails_helper"

RSpec.describe "Publish flow" do
  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Tester", email: "tester@example.com", password: "password123", site: site, role: role) }
  let(:post) { Post.create!(title: "Draft post", site: site, author: user, status: "draft", content: [{ "type" => "paragraph", "data" => { "text" => "v1" } }]) }

  before { Current.user = user }

  it "autosaves to draft without touching live content" do
    live_before = post.content

    post.update!(draft_content: [{ "type" => "paragraph", "data" => { "text" => "new draft" } }])
    post.reload

    expect(post.content).to eq(live_before) # live unchanged
    expect(post.draft_content.first.dig("data", "text")).to eq("new draft")
  end

  it "publishes the draft into live content and records a revision" do
    post.update!(draft_content: [{ "type" => "heading", "data" => { "text" => "v2" } }])
    revisions_before = post.revisions.count

    post.publish_draft!
    post.reload

    expect(post.draft_content).to be_nil
    expect(post.status).to eq("published")
    expect(post.content.first.dig("data", "text")).to eq("v2")
    expect(post.revisions.count).to eq(revisions_before + 1)
  end
end
