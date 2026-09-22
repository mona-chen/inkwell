require "rails_helper"

RSpec.describe "Image Sources plugin", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }
  let(:picture) { Rails.root.join("spec/fixtures/files/test.png").binread }

  before do
    sign_in user
    # The plugin is inactive in a fresh test database, so wire it the way activation does: an
    # active InstalledPlugin row (which the multisite gate reads) and the hooks it registers.
    InstalledPlugin.find_or_create_by!(slug: "image_sources") { |plugin| plugin.name = "Image Sources"; plugin.version = "1.0.0" }
      .update!(active: true)
    ImageSources::Engine.instance.on_activate
  end

  after { Inkwell::Hooks.remove_source!("image_sources") }

  # Outside a request there is no Current.site, and this plugin is site-scoped by design, so the
  # capability tests set it the way the middleware would.
  def with_current_site
    previous = Current.site
    Current.site = site
    yield
  ensure
    Current.site = previous
  end

  def openverse_payload(url: "https://live.example.test/mountains.jpg", **overrides)
    {
      "results" => [ {
        "title" => "Mountains",
        "url" => url,
        "thumbnail" => "https://api.openverse.org/v1/images/abc/thumb/",
        "foreign_landing_url" => "https://www.flickr.com/photos/1",
        "creator" => "Kamil Porembiński",
        "creator_url" => "https://www.flickr.com/photos/1",
        "license" => "by-sa",
        "license_version" => "2.0",
        "license_url" => "https://creativecommons.org/licenses/by-sa/2.0/"
      }.merge(overrides) ]
    }
  end

  def stub_download(bytes: picture, content_type: "image/png")
    allow(ImageSources::Http).to receive(:get_bytes).and_return({ bytes: bytes, content_type: content_type })
  end

  describe "GET /plugins/image_sources/search" do
    it "files an outside photo in the site's own library with its licence and credit" do
      allow(ImageSources::Http).to receive(:get_json).and_return(openverse_payload)
      stub_download

      get "/plugins/image_sources/search", params: { q: "mountains", kind: "photo" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["total"]).to eq(1)

      item = body["results"].first
      expect(item["alt"]).to eq("Mountains")
      expect(item["provider"]).to eq("openverse")
      expect(item["credit"]).to eq("Kamil Porembiński")
      expect(item["license"]).to eq("CC BY-SA 2.0")

      # Never hotlink: the url handed to the page is this site's own file, not the library's CDN.
      stored = MediaItem.last
      expect(stored).to be_external
      expect(stored.file).to be_attached
      expect(item["url"]).to eq(stored.url)
      expect(item["url"]).not_to include("live.example.test")
      # The exact remote resource is the file's identity; the page a reader can visit is the credit.
      expect(stored.source_url).to eq("https://live.example.test/mountains.jpg")
      expect(stored.credit_url).to eq("https://www.flickr.com/photos/1")
      expect(stored.credit_line).to eq("Kamil Porembiński · CC BY-SA 2.0")
    end

    it "asks Openverse for commercially usable licences by default, and the whole index once the site opts in" do
      expect(ImageSources::Http).to receive(:get_json) do |url, *|
        expect(url).to include("license_type=commercial")
        { "results" => [] }
      end
      get "/plugins/image_sources/search", params: { q: "x", kind: "photo" }

      site.set_setting!("image_sources_openverse_license", "all")
      expect(ImageSources::Http).to receive(:get_json) do |url, *|
        expect(url).to include("license_type=all")
        { "results" => [] }
      end
      get "/plugins/image_sources/search", params: { q: "x", kind: "photo" }
    end

    it "falls back to the provider's thumbnail when the original is too heavy to file" do
      allow(ImageSources::Http).to receive(:get_json).and_return(openverse_payload)
      calls = 0
      allow(ImageSources::Http).to receive(:get_bytes) do |url, *|
        calls += 1
        raise ImageSources::Http::Error, "That picture is larger than 12MB, so it was not saved." if calls == 1

        expect(url).to include("/thumb/")
        { bytes: picture, content_type: "image/png" }
      end

      get "/plugins/image_sources/search", params: { q: "mountains", kind: "photo" }

      expect(JSON.parse(response.body)["total"]).to eq(1)
      expect(calls).to eq(2)
    end

    it "keeps what one source returned when another source fails" do
      allow(ImageSources::Http).to receive(:get_json) do |url, *|
        case url
        when /openverse/ then openverse_payload
        when /microlink/ then raise ImageSources::Http::Error, "The image provider answered with 429."
        else { "icons" => [] }
        end
      end
      stub_download

      # A URL query means Microlink is a real participant (it is the one that fails); the other
      # sources still answer, and their results must survive.
      get "/plugins/image_sources/search", params: { q: "https://example.com" }

      body = JSON.parse(response.body)
      expect(body["total"]).to be >= 1
      expect(body["errors"].join).to match(/429/)
      expect(body["guidance"]).to match(/Some sources failed/)
    end

    it "refuses a result that is not an image rather than storing it" do
      allow(ImageSources::Http).to receive(:get_json).and_return(openverse_payload(url: "https://example.test/page.html"))
      stub_download(bytes: "<html></html>", content_type: "text/html")

      get "/plugins/image_sources/search", params: { q: "page", kind: "photo" }

      expect(JSON.parse(response.body)["total"]).to eq(0)
      expect(MediaItem.count).to eq(0)
    end

    it "does not file the same picture twice" do
      allow(ImageSources::Http).to receive(:get_json).and_return(openverse_payload)
      stub_download

      2.times { get "/plugins/image_sources/search", params: { q: "mountains", kind: "photo" } }

      expect(MediaItem.count).to eq(1)
      expect(JSON.parse(response.body)["total"]).to eq(1)
    end

    it "bakes a requested colour into a logo, because an SVG cannot be recoloured once placed" do
      allow(ImageSources::Http).to receive(:get_json).and_return({ "icons" => [ "simple-icons:github", "simple-icons:githubpages" ] })
      urls = []
      allow(ImageSources::Http).to receive(:get_bytes) { |url, *| urls << url; { bytes: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>", content_type: "image/svg+xml" } }

      get "/plugins/image_sources/search", params: { q: "github", kind: "logo", color: "#ffffff" }

      body = JSON.parse(response.body)
      expect(body["total"]).to eq(2)
      expect(urls).to contain_exactly("https://cdn.simpleicons.org/github/ffffff", "https://cdn.simpleicons.org/githubpages/ffffff")
      expect(body["results"].first["alt"]).to eq("Github logo")
      expect(body["results"].first["license"]).to match(/CC0/)
    end

    it "captures a screenshot of a live URL" do
      allow(ImageSources::Http).to receive(:get_json).and_return(
        { "status" => "success", "data" => { "screenshot" => { "url" => "https://iad.microlink.io/abc.png" } } }
      )
      stub_download

      get "/plugins/image_sources/search", params: { q: "https://example.com", kind: "screenshot" }

      item = JSON.parse(response.body)["results"].first
      expect(item["provider"]).to eq("microlink")
      expect(item["alt"]).to eq("Screenshot of example.com")
      expect(MediaItem.last.source_url).to eq("https://iad.microlink.io/abc.png")
      expect(MediaItem.last.credit_url).to eq("https://example.com")
    end

    it "generates a deterministic avatar from the query without filing it twice" do
      urls = []
      allow(ImageSources::Http).to receive(:get_bytes) { |url, *| urls << url; { bytes: picture, content_type: "image/png" } }
      allow(ImageSources::Http).to receive(:get_json).and_return({})

      get "/plugins/image_sources/search", params: { q: "Ada Lovelace", kind: "avatar", limit: 2 }
      first = urls.dup
      first_ids = JSON.parse(response.body)["results"].map { |result| result["id"] }

      get "/plugins/image_sources/search", params: { q: "Ada Lovelace", kind: "avatar", limit: 2 }

      # Same words → same seed → the same characters, and the repeat reuses the files it already
      # filed instead of duplicating them.
      expect(first.first).to include("seed=ada-lovelace")
      expect(urls).to eq(first)
      expect(JSON.parse(response.body)["results"].map { |result| result["id"] }).to eq(first_ids)
    end

    it "reports the kinds a site can actually reach instead of guessing" do
      get "/plugins/image_sources/search", params: { q: "x", kind: "hologram" }

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body["error"]).to match(/hologram/)
      expect(body["available_kinds"]).to include("photo", "logo", "avatar", "mascot", "screenshot")
    end

    it "asks for a description rather than searching for nothing" do
      get "/plugins/image_sources/search", params: { q: "   " }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to match(/Describe/)
    end
  end

  describe "the Copilot capability" do
    it "publishes the search endpoint only while this site can serve it" do
      with_current_site do
        config = Inkwell::Hooks.filter(:builder_copilot_config, { mediaUrl: "/admin/media" })
        expect(config[:imageSearchUrl]).to eq("/plugins/image_sources/search")
        expect(config[:imageProviders].map { |entry| entry[:kind] }).to eq(%w[photo logo avatar mascot screenshot])

        site.set_setting!("image_sources_providers", "openverse")
        expect(Inkwell::Hooks.filter(:builder_copilot_config, {})[:imageProviders].map { |entry| entry[:kind] }).to eq([ "photo" ])

        # An unset value means "never configured", which is everything on.
        site.set_setting!("image_sources_providers", nil)
        expect(Inkwell::Hooks.filter(:builder_copilot_config, {})[:imageProviders].size).to eq(5)

        # Switching every source off is a real answer, not an accidental "all on".
        site.set_setting!("image_sources_providers", "none")
        expect(Inkwell::Hooks.filter(:builder_copilot_config, {})).not_to have_key(:imageSearchUrl)

        Inkwell::Hooks.remove_source!("image_sources")
        expect(Inkwell::Hooks.filter(:builder_copilot_config, {})).not_to have_key(:imageSearchUrl)
      end
    end

    it "keeps the credit on the file even after the plugin is switched off" do
      allow(ImageSources::Http).to receive(:get_json).and_return(openverse_payload)
      stub_download
      get "/plugins/image_sources/search", params: { q: "mountains", kind: "photo" }

      with_current_site do
        Inkwell::Hooks.remove_source!("image_sources")

        expect(MediaItem.last.credit_line).to eq("Kamil Porembiński · CC BY-SA 2.0")
      end
    end
  end

  describe "settings" do
    it "shows every source and its state" do
      get "/plugins/image_sources/settings"

      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Openverse", "Simple Icons", "Microlink")
    end

    it "remembers which sources are on, and treats an empty choice as none" do
      patch "/plugins/image_sources/settings", params: { image_sources: { providers: %w[openverse microlink], openverse_license: "all", microlink_api_key: "k" } }
      expect(response).to redirect_to("/plugins/image_sources/settings")
      expect(site.reload.setting("image_sources_providers")).to eq("openverse,microlink")
      expect(site.reload.setting("image_sources_openverse_license")).to eq("all")
      expect(site.reload.setting("image_sources_microlink_api_key")).to eq("k")

      patch "/plugins/image_sources/settings", params: { image_sources: { providers: [] } }
      expect(site.reload.setting("image_sources_providers")).to eq("none")
      expect(ImageSources::Registry.enabled(site)).to eq([])
    end

    it "refuses a source key it does not recognise" do
      patch "/plugins/image_sources/settings", params: { image_sources: { providers: %w[openverse something_else] } }

      expect(site.reload.setting("image_sources_providers")).to eq("openverse")
    end
  end

  describe ImageSources::Http do
    it "refuses an address that is not reachable from the public internet" do
      expect { described_class.get_bytes("http://127.0.0.1/x.png") }.to raise_error(ImageSources::Http::Error, /not reachable/)
      expect { described_class.get_bytes("http://169.254.169.254/latest/meta-data/") }.to raise_error(ImageSources::Http::Error, /not reachable/)
      expect { described_class.get_bytes("http://10.0.0.5/x.png") }.to raise_error(ImageSources::Http::Error, /not reachable/)
    end

    it "refuses a scheme that is not http(s)" do
      expect { described_class.get_bytes("file:///etc/passwd") }.to raise_error(ImageSources::Http::Error, /http\(s\)/)
    end
  end
end
