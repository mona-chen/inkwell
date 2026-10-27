require "rails_helper"

RSpec.describe ContentDocument do
  it "extracts formatted paragraphs and hard breaks without counting JSON or mark metadata" do
    json = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello", marks: [{ type: "bold" }] }, { type: "hardBreak" }, { type: "text", text: "world" }] }] }.to_json
    expect(described_class.new([{ "type" => "rich_text", "data" => { "json" => json } }]).words).to eq(%w[Hello world])
  end

  it "counts builder headings and links but excludes runtime scripts and styles" do
    doc = described_class.new([{ "type" => "page_builder", "data" => { "html" => '<h2>A heading</h2><p>Text <a href="/about">About</a></p><script>secretRuntime()</script><style>.x{}</style><img src="/x.png" alt="Cover">' } }])
    expect(doc.headings).to eq(1)
    expect(doc.links).to eq(1)
    expect(doc.images.first["alt"]).to eq("Cover")
    expect(doc.text).not_to include("secretRuntime", ".x")
  end

  it "generates public metadata from published rich text, without leaking draft text" do
    record = Post.new(content: [{ type: "rich_text", data: { json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Published summary" }] }] }.to_json } }], draft_content: [{ type: "paragraph", data: { text: "Secret draft" } }])
    expect(record.auto_meta_description).to eq("Published summary")
    record.site = Site.new(name: "Metadata", domain: "metadata.test")
    record.slug = "published-summary"
    tags = Nokogiri::HTML.fragment(Seo::MetaTagBuilder.new(record).build_all.join)
    expect(tags.at_css('meta[name="description"]')["content"]).to eq("Published summary")
  end
end
