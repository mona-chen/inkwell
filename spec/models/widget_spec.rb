require 'rails_helper'

RSpec.describe Widget, type: :model do
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }

  it "validates kind and area against the supported lists" do
    w = site.widgets.build(kind: "bogus", area: "sidebar")
    expect(w).not_to be_valid
    expect(w.errors[:kind]).to be_present

    w.kind = "text"
    w.area = "nowhere"
    expect(w).not_to be_valid
    expect(w.errors[:area]).to be_present

    w.area = "footer-2"
    w.title = "Hi"
    expect(w).to be_valid
  end

  it "orders widgets within an area by position" do
    site.widgets.create!(kind: "text", area: "sidebar", title: "Second", position: 2, config: {})
    site.widgets.create!(kind: "text", area: "sidebar", title: "First", position: 1, config: {})
    expect(site.widgets.in_area("sidebar").map(&:title)).to eq(%w[First Second])
  end
end
