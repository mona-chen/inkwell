require "rails_helper"

RSpec.describe "Publishing persists block edits", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }
  let(:page) do
    Page.create!(
      title: "Test Page", site: site, author: user, status: "published",
      content: [
        { "type" => "paragraph", "data" => { "text" => "paragraph one" } },
        { "type" => "paragraph", "data" => { "text" => "paragraph two" } }
      ]
    )
  end

  before { sign_in user }

  it "does not resurrect deleted blocks when publishing right after a delete" do
    # The editor deleted "paragraph one"; the hidden field carries only paragraph two, and
    # the Publish button submits it with the form.
    draft_json = JSON.generate([{ "type" => "paragraph", "data" => { "text" => "paragraph two" } }])

    post "/admin/pages/#{page.slug}/publish", params: { page: { draft_content: draft_json } }
    expect(response).to have_http_status(:redirect)

    page.reload
    expect(page.draft_content).to be_nil
    expect(page.content_blocks.map { |b| b["data"]["text"] }).to eq(["paragraph two"])
  end
end
