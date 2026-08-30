require "rails_helper"

RSpec.describe WebsiteImport, type: :model do
  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Tester", email: "tester@example.com", password: "password123", site: site, role: role) }

  def build_import(overrides = {})
    site.website_imports.build({
      user: user,
      source_url: "https://example.com",
      max_depth: 3,
      max_pages: 10,
      ownership_confirmed: true
    }.merge(overrides))
  end

  it "requires ownership to be confirmed to be valid" do
    expect(build_import(ownership_confirmed: true)).to be_valid
  end

  it "rejects imports created without an ownership confirmation" do
    unconfirmed = build_import(ownership_confirmed: nil)
    expect(unconfirmed).not_to be_valid
    expect(unconfirmed.errors[:ownership_confirmed]).to be_present

    explicitly_false = build_import(ownership_confirmed: false)
    expect(explicitly_false).not_to be_valid
    expect(explicitly_false.errors[:ownership_confirmed]).to be_present
  end

  it "accepts the checked-checkbox value" do
    expect(build_import(ownership_confirmed: "1")).to be_valid
  end
end
