require "rails_helper"
require "tmpdir"

RSpec.describe PageBuilder::CapturedSiteImporter do
  let(:site) { Site.create!(name: "Import", domain: "import.example.com") }
  let(:role) { Role.create!(name: "admin") }
  let(:user) { User.create!(name: "Importer", email: "capture@example.com", password: "password123", site: site, role: role) }

  it "retains source HTML and paths and seeds editable SEO without executing the runtime" do
    Dir.mktmpdir do |root|
      directory = Pathname.new(root).join("capture", "pages", "article")
      FileUtils.mkdir_p(directory)
      source = "https://source.example/blogs/an-article"
      directory.join("manifest.json").write(JSON.generate(source: source))
      directory.join("source.html").write('<html><head><title>Source title</title><meta name="description" content="Source description"><script>window.originalRuntime = true;</script></head><body>Article</body></html>')
      payload = { "pages" => [{ "title" => "Article", "slug" => "article", "source" => source,
        "payload" => { "children" => [], "settings" => {}, "initialHtml" => "<p>Editable</p>" } }] }
      importer = described_class.new(site: site, user: user, capture_id: "capture", captures_root: root)
      importer.import!(payload)
      page = site.pages.last
      expect(page.public_path).to eq("/blogs/an-article")
      expect(page.seo_title).to eq("Source title")
      expect(page.seo_description).to eq("Source description")
      expect(page.original_import_html).to include("window.originalRuntime = true;")
      expect(page.status).to eq("draft")
      page.update!(seo_title: "Owner's title")
      importer.import!(payload)
      expect(page.reload.seo_title).to eq("Owner's title")
      expect(site.pages.count).to eq(1)
    end
  end
end

RSpec.describe "Refreshing preserved captures" do
  let(:site) { Site.create!(name: "Refresh", domain: "refresh.example.com") }
  let(:role) { Role.create!(name: "admin") }
  let(:user) { User.create!(name: "Owner", email: "refresh@example.com", password: "password123", site: site, role: role) }

  it "refreshes original HTML across capture IDs without resetting publication, SEO or native edits" do
    page = site.pages.create!(author: user, title: "Owner title", slug: "owner", status: "published", template: "landing",
      public_path: "/", live_render_mode: "original_import", original_import_url: "https://source.test/",
      original_import_html: "Old", seo_title: "Owner SEO", content: [{ "type" => "paragraph", "data" => { "text" => "Owner content" } }],
      meta: { "import_capture" => "old", "custom" => "retained" })
    Dir.mktmpdir do |root|
      directory = Pathname.new(root).join("fresh/pages/home")
      FileUtils.mkdir_p(directory)
      directory.join("manifest.json").write(JSON.generate(source: "https://source.test/"))
      directory.join("source.html").write('<html><head><title>New source</title><meta name="description" content="Seeded description"></head><body>Fresh original</body></html>')
      payload = { "source" => "https://source.test/", "pages" => [
        { "source" => "https://source.test/", "title" => "New source", "slug" => "home", "payload" => {} },
        { "source" => "https://cms.test/", "title" => "CMS duplicate", "slug" => "home", "payload" => {} }
      ] }
      result = PageBuilder::CapturedSiteImporter.new(site: site, user: user, capture_id: "fresh", captures_root: root).import!(payload)
      expect(result.size).to eq(1)
      expect(page.reload.original_import_html).to include("Fresh original")
      expect(page.title).to eq("Owner title")
      expect(page.seo_title).to eq("Owner SEO")
      expect(page.seo_description).to eq("Seeded description")
      expect(page.status).to eq("published")
      expect(page.live_render_mode).to eq("original_import")
      expect(page.content.first.dig("data", "text")).to eq("Owner content")
      expect(page.meta).to include("custom" => "retained", "import_source_aliases" => ["https://cms.test/", "https://source.test/"])
      expect(site.pages.count).to eq(1)
    end
  end
  it "keeps an explicitly selected source on later recaptures with another primary origin" do
    page = site.pages.create!(author: user, title: "Owner title", slug: "home", status: "published",
      public_path: "/", live_render_mode: "original_import", original_import_url: "https://old.test/",
      original_import_html: "Old", seo_title: "Owner SEO",
      meta: { "import_preservation_source" => "https://updated.test/" })
    Dir.mktmpdir do |root|
      ["old", "updated"].each do |origin|
        directory = Pathname.new(root).join("fresh/pages", origin)
        FileUtils.mkdir_p(directory)
        directory.join("manifest.json").write(JSON.generate(source: "https://#{origin}.test/"))
        directory.join("source.html").write("<html><body>#{origin} design</body></html>")
      end
      payload = { "source" => "https://old.test/", "pages" => ["old", "updated"].map { |origin|
        { "source" => "https://#{origin}.test/", "title" => "Source", "slug" => "home", "payload" => {} }
      } }
      PageBuilder::CapturedSiteImporter.new(site: site, user: user, capture_id: "fresh", captures_root: root).import!(payload)
      expect(page.reload.original_import_html).to include("updated design")
      expect(page.original_import_url).to eq("https://updated.test/")
      expect(page.meta["import_source_aliases"]).to include("https://old.test/", "https://updated.test/")
      expect(page.seo_title).to eq("Owner SEO")
      expect(page.status).to eq("published")
      expect(site.pages.count).to eq(1)
    end
  end

end
