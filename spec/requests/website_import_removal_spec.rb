require "rails_helper"
RSpec.describe "Website import removal", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Import site", domain: "import.test") }
  let!(:role) { Role.create!(name: "admin") }
  let!(:user) { User.create!(name: "Owner", email: "remove-import@example.test", password: "password123", site: site, role: role) }
  let!(:capture) { site.website_imports.create!(user: user, source_url: "https://source.test", status: "imported", ownership_confirmed: true) }
  before { sign_in user }
  def imported_page(title, capture_id)
    site.pages.create!(title: title, author: user, template: "landing", status: "published", meta: { "import_capture" => capture_id })
  end
  it "exposes both removal choices and keeps pages by default" do
    item = imported_page("Keep", capture.capture_id)
    capture.update!(imported_page_ids: [item.id])
    get "/admin/website_imports/#{capture.id}"
    expect(response.body).to include("Remove import, keep pages", "Remove import &amp; trash pages")
    delete "/admin/website_imports/#{capture.id}"
    expect(WebsiteImport.exists?(capture.id)).to be(false)
    expect(site.setting("removed_site_captures")).to include(capture.capture_id)
    expect(item.reload.status).to eq("published")
  end
  it "only trashes pages still owned by this import" do
    owned = imported_page("Owned", capture.capture_id)
    reclaimed = imported_page("Reclaimed", "newer-capture")
    capture.update!(imported_page_ids: [owned.id, reclaimed.id])
    delete "/admin/website_imports/#{capture.id}", params: { disposition: "trash_pages" }
    expect(owned.reload.status).to eq("trashed")
    expect(reclaimed.reload.status).to eq("published")
  end
  it "rejects removal while capture is running" do
    capture.update!(status: "capturing")
    delete "/admin/website_imports/#{capture.id}"
    expect(capture.reload.status).to eq("capturing")
    expect(response).to redirect_to("/admin/website_imports/#{capture.id}")
  end
end
