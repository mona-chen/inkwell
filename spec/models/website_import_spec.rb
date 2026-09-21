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

  describe "additional website origins" do
    it "defaults to no extra origins" do
      expect(build_import).to be_valid
      expect(build_import.allowed_origins).to eq([])
    end

    it "normalizes a pasted list into deduplicated origins" do
      record = build_import(additional_origins: "https://your-site.framer.ai/\nhttps://cdn.example.com, https://your-site.framer.ai")

      expect(record.allowed_origins).to eq([ "https://your-site.framer.ai", "https://cdn.example.com" ])
      expect(record).to be_valid
    end

    it "treats a blank entry as no extra origins" do
      expect(build_import(additional_origins: "  ").allowed_origins).to eq([])
    end

    it "rejects entries that are not bare HTTP(S) origins" do
      [
        "https://site.framer.ai/blog",
        "https://site.framer.ai?utm=1",
        "https://user:pass@site.framer.ai",
        "ftp://site.framer.ai"
      ].each do |origin|
        record = build_import(additional_origins: origin)

        expect(record).not_to be_valid, "expected #{origin.inspect} to be rejected"
        expect(record.errors[:additional_origins]).to be_present
      end
    end

    it "rejects more than ten origins" do
      record = build_import(additional_origins: (1..11).map { |index| "https://site#{index}.example.com" }.join("\n"))

      expect(record).not_to be_valid
      expect(record.errors[:additional_origins]).to be_present
    end
  end
end
