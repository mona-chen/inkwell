require "rails_helper"
require "cgi"

RSpec.describe "AI Writer web tools", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  # The cache is process-wide, so a page read in one example must never answer the next one.
  before do
    sign_in user
    AiWriter::WebClient.cache.clear
  end

  def fake_response(body:, content_type: "text/html")
    response = Object.new
    response.define_singleton_method(:body) { body }
    response.define_singleton_method(:[]) { |key| key.to_s.downcase == "content-type" ? content_type : nil }
    response
  end

  def with_current_site
    previous = Current.site
    Current.site = site
    yield
  ensure
    Current.site = previous
  end

  describe AiWriter::WebClient do
    it "reduces a page to a title and readable text" do
      client = AiWriter::WebClient.new(site: site)
      html = <<~HTML
        <html><head><title>Ruut — Pricing</title><style>.x{}</style></head>
        <body><nav>Home About</nav><h1>Simple pricing</h1><script>track()</script>
        <p>One plan,   billed yearly.</p><footer>© 2026</footer></body></html>
      HTML
      allow(client).to receive(:request).and_return([ URI.parse("https://ruut.chat/pricing"), fake_response(body: html) ])

      page = client.fetch("https://ruut.chat/pricing")

      expect(page["title"]).to eq("Ruut — Pricing")
      expect(page["text"]).to include("Simple pricing")
      expect(page["text"]).to include("One plan, billed yearly.")
      # Chrome and script are stripped; whitespace is collapsed so the model reads prose, not markup.
      expect(page["text"]).not_to include("track()")
      expect(page["text"]).not_to include("Home About")
      expect(page["text"]).not_to include("© 2026")
      expect(page["text"]).not_to include("  ")
    end

    it "adds the scheme when the model hands over a bare host" do
      client = AiWriter::WebClient.new(site: site)
      allow(client).to receive(:request) do |url, **_|
        expect(url).to eq("https://example.com/about")
        [ URI.parse(url), fake_response(body: "<title>About</title><p>Hi</p>") ]
      end

      expect(client.fetch("example.com/about")["url"]).to eq("https://example.com/about")
    end

    it "caps what it hands the model rather than pasting a whole site into the prompt" do
      client = AiWriter::WebClient.new(site: site)
      allow(client).to receive(:request).and_return([ URI.parse("https://example.com"), fake_response(body: "<p>#{'word ' * 9000}</p>") ])

      page = client.fetch("https://example.com")

      expect(page["truncated"]).to be(true)
      expect(page["text"].length).to be <= AiWriter::WebClient::MAX_TEXT
    end

    it "caches a page so a follow-up round does not re-fetch it" do
      client = AiWriter::WebClient.new(site: site)
      expect(client).to receive(:request).once.and_return([ URI.parse("https://example.com"), fake_response(body: "<p>Hi</p>") ])

      2.times { client.fetch("https://example.com") }
    end

    # The query and the URL both come from a language model, so "fetch this" must never reach the
    # server's own network or a cloud metadata endpoint.
    it "refuses a page on a private address instead of probing the local network" do
      client = AiWriter::WebClient.new(site: site)

      expect { client.fetch("http://169.254.169.254/latest/meta-data/") }.to raise_error(AiWriter::WebClient::Error, /not reachable/)
      expect { client.fetch("http://127.0.0.1:3000/admin") }.to raise_error(AiWriter::WebClient::Error, /not reachable/)
    end

    it "refuses a scheme that is not http(s)" do
      client = AiWriter::WebClient.new(site: site)

      expect { client.fetch("file:///etc/passwd") }.to raise_error(AiWriter::WebClient::Error, /http\(s\)/)
    end

    it "is on by default and off only when the operator says so" do
      expect(AiWriter::WebClient.new(site: site).fetch_enabled?).to be(true)
      site.set_setting!("web_fetch_enabled", "0")
      expect(AiWriter::WebClient.new(site: site).fetch_enabled?).to be(false)
    end

    it "keeps search off until a provider and a key are both present" do
      client = AiWriter::WebClient.new(site: site)
      expect(client.search_configured?).to be(false)
      expect { client.search("anything") }.to raise_error(AiWriter::WebClient::Error, /not configured/)

      site.set_setting!("web_search_provider", "brave")
      expect(AiWriter::WebClient.new(site: site).search_configured?).to be(false)

      site.set_setting!("web_search_api_key", "sk-test")
      expect(AiWriter::WebClient.new(site: site).search_configured?).to be(true)
    end

    it "normalizes a provider's own result shape into title/url/snippet" do
      site.set_setting!("web_search_provider", "brave")
      site.set_setting!("web_search_api_key", "sk-test")
      client = AiWriter::WebClient.new(site: site)
      allow(client).to receive(:get_json).and_return(
        "web" => { "results" => [ { "title" => "Pricing", "url" => "https://example.com/pricing", "description" => "<b>Plans</b> from $9" } ] }
      )

      data = client.search("pricing", limit: 3)

      expect(data["provider"]).to eq("brave")
      expect(data["results"].first).to eq("title" => "Pricing", "url" => "https://example.com/pricing", "snippet" => "Plans from $9")
    end

    # A self-hosted SearXNG needs no key, and naming its base URL is itself the choice of provider.
    it "treats a self-hosted search base URL as a configured, keyless provider" do
      site.set_setting!("web_search_base_url", "http://localhost:8080")
      client = AiWriter::WebClient.new(site: site)

      expect(client.provider).to eq("searxng")
      expect(client.search_configured?).to be(true)

      allow(client).to receive(:searxng_get).and_return(
        "results" => [ { "title" => "Docs", "url" => "https://example.com/docs", "content" => "Everything" } ]
      )
      expect(client.search("docs")["results"].first["url"]).to eq("https://example.com/docs")
    end

    it "reports a provider refusal with the provider's own reason" do
      site.set_setting!("web_search_provider", "tavily")
      site.set_setting!("web_search_api_key", "sk-test")
      client = AiWriter::WebClient.new(site: site)
      response = Object.new
      response.define_singleton_method(:is_a?) { |klass| klass == Net::HTTPSuccess }
      response.define_singleton_method(:code) { "401" }
      response.define_singleton_method(:body) { '{"detail":{"message":"Invalid API key"}}' }
      allow(client).to receive(:post_json).and_raise(AiWriter::WebClient::Error, "The search provider answered with 401: Invalid API key")

      expect { client.search("anything") }.to raise_error(AiWriter::WebClient::Error, /Invalid API key/)
    end
  end

  describe "the browser endpoint" do
    def stub_web_client(**overrides)
      client = instance_double(AiWriter::WebClient,
                               fetch_enabled?: true, search_configured?: true,
                               fetch: { "url" => "https://example.com", "title" => "Example", "text" => "Hello", "truncated" => false },
                               search: { "query" => "x", "provider" => "brave", "results" => [] })
      allow(AiWriter::WebClient).to receive(:new).and_return(client)
      allow(client).to receive(**overrides) if overrides.any?
      client
    end

    it "reads a page the model asked for" do
      stub_web_client
      post "/plugins/ai_writer/web", params: { op: "fetch", url: "https://example.com" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["title"]).to eq("Example")
    end

    it "searches when search is configured" do
      stub_web_client
      post "/plugins/ai_writer/web", params: { op: "search", query: "pricing" }, as: :json
      expect(response).to have_http_status(:ok)
    end

    it "refuses search with a reason when no provider is configured" do
      client = stub_web_client
      allow(client).to receive(:search_configured?).and_return(false)
      post "/plugins/ai_writer/web", params: { op: "search", query: "pricing" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to match(/not configured/)
    end

    it "refuses a page read when the operator switched it off" do
      client = stub_web_client
      allow(client).to receive(:fetch_enabled?).and_return(false)
      post "/plugins/ai_writer/web", params: { op: "fetch", url: "https://example.com" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to match(/switched off/)
    end

    it "surfaces a WebClient failure as a message the model can act on" do
      client = stub_web_client
      allow(client).to receive(:fetch).and_raise(AiWriter::WebClient::Error, "That page is not reachable from here.")
      post "/plugins/ai_writer/web", params: { op: "fetch", url: "http://169.254.169.254/" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)["error"]).to match(/not reachable/)
    end
  end

  # The block editor's Copilot runs a server-owned loop, so the web tools are advertised there
  # too. The rule is the same one the browser tools follow: never offer what we cannot serve.
  describe "the block editor's agent path" do
    # The tool executor streams each turn, so a tool must be exercised while the response stream
    # is open — hence the probe, run inside the stubbed stream_chat rather than after the request.
    def stub_agent(probe: nil)
      client = instance_double(AiWriter::Client, configured?: true)
      captured = {}
      allow(client).to receive(:stream_chat) do |_messages, system:, tools:, tool_executor:, &block|
        captured[:system] = system
        captured[:tools] = tools
        captured[:result] = probe.call(tool_executor) if probe
        block.call("ok")
      end
      allow(AiWriter::Client).to receive(:new).with(site: site).and_return(client)
      captured
    end

    PAGE = { "url" => "https://example.com", "title" => "Example", "text" => "Body", "truncated" => false }.freeze

    def stub_web_client(fetch_enabled: true, search_configured: false, provider: nil,
                        fetch: PAGE, search: { "query" => "q", "provider" => "brave", "results" => [] })
      web = instance_double(AiWriter::WebClient, fetch_enabled?: fetch_enabled, search_configured?: search_configured,
                            provider: provider, fetch: fetch, search: search)
      allow(AiWriter::WebClient).to receive(:new).and_return(web)
      web
    end

    it "offers fetch_web_page and the research discipline, but not a search it cannot serve" do
      site.set_setting!("ai_api_key", "k")
      stub_web_client
      captured = stub_agent

      post "/plugins/ai_writer/chat", params: { mode: "draft", prompt: "write about our pricing", blocks: [] }

      names = captured[:tools].map { |t| t["function"]["name"] }
      expect(names).to include("fetch_web_page")
      expect(names).not_to include("web_search")
      expect(captured[:system]).to include("WEB RESEARCH")
      expect(captured[:system]).to include("paraphrase")
    end

    it "offers web_search once a provider is configured" do
      site.set_setting!("ai_api_key", "k")
      stub_web_client(search_configured: true, provider: "brave")
      captured = stub_agent

      post "/plugins/ai_writer/chat", params: { mode: "draft", prompt: "research competitors", blocks: [] }

      expect(captured[:tools].map { |t| t["function"]["name"] }).to include("web_search")
    end

    it "offers no web tools, and says so, when the site has none" do
      site.set_setting!("ai_api_key", "k")
      site.set_setting!("web_fetch_enabled", "0")
      stub_web_client(fetch_enabled: false)
      captured = stub_agent

      post "/plugins/ai_writer/chat", params: { mode: "draft", prompt: "write something", blocks: [] }

      names = captured[:tools].map { |t| t["function"]["name"] }
      expect(names).not_to include("fetch_web_page", "web_search")
      expect(captured[:system]).not_to include("WEB RESEARCH")
    end

    it "runs a web tool and hands the model something it can act on" do
      site.set_setting!("ai_api_key", "k")
      stub_web_client(search_configured: true, provider: "brave",
                      search: { "query" => "notion pricing", "provider" => "brave",
                                "results" => [ { "title" => "Pricing", "url" => "https://notion.so/pricing", "snippet" => "Plans" } ] })
      captured = stub_agent(probe: ->(executor) { executor.call("web_search", { "query" => "notion pricing" }) })

      post "/plugins/ai_writer/chat", params: { mode: "draft", prompt: "research pricing", blocks: [] }

      expect(captured[:result]).to include("https://notion.so/pricing")
      expect(captured[:result]).to include("Research only")
      expect(captured[:result]).to include("notion pricing")
    end

    # A configured-but-unreachable research server used to just make its tools vanish. The model
    # should be told, so it stops waiting for research and can say so to the user.
    it "says the research server is unreachable instead of silently dropping its tools" do
      site.set_setting!("ai_api_key", "k")
      site.set_setting!("mcp_enabled", "1")
      site.set_setting!("mcp_token", "t")
      stub_web_client
      mcp = instance_double(AiWriter::McpClient)
      allow(mcp).to receive(:tools).and_raise(AiWriter::McpClient::Error, "MCP request failed (429): rate limited")
      # research_skills is a best-effort extra; the point of this example is that #tools failing
      # is surfaced rather than silent.
      allow(mcp).to receive(:call).and_return("")
      allow(AiWriter::McpClient).to receive(:new).and_return(mcp)
      captured = stub_agent

      post "/plugins/ai_writer/chat", params: { mode: "design", env: "html", prompt: "build a page", blocks: [] }

      expect(captured[:system]).to include("research server is not responding")
      expect(captured[:system]).to include("429")
      expect(captured[:tools].map { |t| t["function"]["name"] }).not_to include("search_designs")
    end

    # A dead server used to be re-contacted for the tool list, the skills and the brand research —
    # each with a 90-second budget, none of them able to succeed. One failed connection is the
    # whole cost now, and a brand request still completes.
    it "pays for a dead research server once, and a brand request still builds" do
      site.set_setting!("ai_api_key", "k")
      site.set_setting!("mcp_enabled", "1")
      site.set_setting!("mcp_token", "t")
      stub_web_client
      mcp = instance_double(AiWriter::McpClient)
      expect(mcp).to receive(:tools).once.and_raise(AiWriter::McpClient::Error, "MCP request failed (429)")
      allow(AiWriter::McpClient).to receive(:new).and_return(mcp)
      captured = stub_agent

      post "/plugins/ai_writer/chat", params: { mode: "design", env: "html", prompt: "build a page", brand: "stripe", blocks: [] }

      expect(response).to have_http_status(:ok)
      expect(captured[:system]).to include("research server is not responding")
      expect(captured[:system]).not_to include("## Design skill")
      expect(captured[:system]).not_to include("DESIGN WITH THE AESTHETIC")
    end
  end

  describe "the Copilot capability" do
    it "publishes a tool only while the server can serve it" do
      caps = -> { AiWriter::WebClient.capabilities(site) }

      expect(caps.call[:webFetchUrl]).to eq("/plugins/ai_writer/web")
      expect(caps.call).not_to have_key(:webSearchUrl)

      site.set_setting!("web_search_provider", "brave")
      expect(caps.call).not_to have_key(:webSearchUrl)

      site.set_setting!("web_search_api_key", "sk-test")
      expect(caps.call[:webSearchUrl]).to eq("/plugins/ai_writer/web")
      expect(caps.call[:webSearchProvider]).to eq("Brave Search")

      site.set_setting!("web_fetch_enabled", "0")
      expect(caps.call).not_to have_key(:webFetchUrl)
    end

    # The decision above only matters if the template actually carries it to the browser; this is
    # the integration point that has silently broken before.
    it "reaches the builder page's Copilot config" do
      InstalledPlugin.find_or_create_by!(slug: "ai_writer") { |plugin| plugin.name = "Copilot"; plugin.version = "1.0.0" }
        .update!(active: true)
      page = site.pages.create!(title: "Home", template: "default", author: user)

      get "/builder/page/#{page.id}"

      expect(response).to have_http_status(:ok)
      config = response.body[/data-builder-copilot-config-value="([^"]+)"/, 1]
      expect(config).to be_present
      json = JSON.parse(CGI.unescapeHTML(config))
      expect(json["webFetchUrl"]).to eq("/plugins/ai_writer/web")
      expect(json).not_to have_key("webSearchUrl")
    end
  end
end
