require "rails_helper"
RSpec.describe "Website import completion and retry", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Import", domain: "complete.test") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:user) { User.create!(name: "Owner", email: "retry@test.example", password: "password123", site: site, role: role) }
  let!(:capture) { site.website_imports.create!(user: user, source_url: "https://example.com", ownership_confirmed: true, status: "ready", mapped_pages: 3, captured_pages: 3) }
  before { sign_in user }
  it "distinguishes capture readiness from pages actually imported" do
    get "/admin/website_imports/#{capture.id}"
    expect(response.body).to include("Import 3 editable pages", "Pages created", "pages have not been created yet", "85%")
  end
  it "requeues a failed capture and clears stale success counters" do
    capture.update!(status: "failed", mapped_pages: 4, error_message: "Empty capture")
    expect(WebsiteImportJob).to receive(:perform_later).with(capture.id)
    post "/admin/website_imports/#{capture.id}/retry"
    expect(response).to redirect_to(admin_website_import_path(capture))
    expect(capture.reload).to have_attributes(status: "queued", mapped_pages: 0, error_message: nil)
  end
  it "does not enqueue duplicate work for an active import" do
    capture.update!(status: "capturing")
    expect(WebsiteImportJob).not_to receive(:perform_later)
    post "/admin/website_imports/#{capture.id}/retry"
    expect(capture.reload.status).to eq("capturing")
  end
  it "recovers earlier empty captures that were incorrectly marked ready" do
    capture.update!(mapped_pages: 0, captured_pages: 0)
    get "/admin/website_imports/#{capture.id}"
    expect(response.body).to include("Capture failed: no pages found", "Retry capture")
    expect(response.body).not_to include("Import 0 editable pages", "Next: create your editable pages")
    expect(WebsiteImportJob).to receive(:perform_later).with(capture.id)
    post "/admin/website_imports/#{capture.id}/retry"
    expect(capture.reload.status).to eq("queued")
  end

end
