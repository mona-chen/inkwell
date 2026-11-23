require "rails_helper"

RSpec.describe ThemeRuntime::Document do
  let!(:site) { Site.create!(name: "Ruut", domain: "ruut.chat") }
  let(:html) { '<html><head><link rel="icon" href="/theme-icon.png"></head><body><h1>Journal</h1></body></html>' }

  def document
    Nokogiri::HTML5.parse(described_class.new(html: html, data: {}, site: site).render)
  end

  it "applies the site's favicon consistently without changing the body" do
    site.set_setting!("site_favicon", "https://ruut.chat/images/ruut-mark.svg")
    result = document
    expect(result.css('link[rel="icon"]').map { |node| node["href"] }).to eq([ "https://ruut.chat/images/ruut-mark.svg" ])
    expect(result.at_css("h1").text).to eq("Journal")
  end

  it "preserves the theme icon when the site has no override" do
    expect(document.at_css('link[rel="icon"]')["href"]).to eq("/theme-icon.png")
  end

  it "ignores unsafe favicon schemes" do
    site.set_setting!("site_favicon", "javascript:alert(1)")
    expect(document.at_css('link[rel="icon"]')["href"]).to eq("/theme-icon.png")
  end
end
