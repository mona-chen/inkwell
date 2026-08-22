require "rails_helper"

RSpec.describe "AI Writer plugin", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  before { sign_in user }

  describe AiWriter::Client do
    def fake_http(response_body)
      response = Object.new
      response.define_singleton_method(:is_a?) { |klass| klass == Net::HTTPSuccess }
      response.define_singleton_method(:read_body) { |&b| b.call(response_body) }
      http = Object.new
      http.define_singleton_method(:request) { |_req, &b| b.call(response) }
      http
    end

    it "yields SSE deltas from a streaming provider" do
      site.set_setting!("ai_api_key", "k")
      client = AiWriter::Client.new(site: site)
      allow(client).to receive(:http).and_return(
        fake_http("data: {\"choices\":[{\"delta\":{\"content\":\"Hel\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\ndata: [DONE]\n\n")
      )
      chunks = []
      client.stream_chat([ { role: "user", content: "hi" } ]) { |d| chunks << d }
      expect(chunks).to eq([ { content: "Hel" }, { content: "lo" } ])
    end

    it "falls back to a non-streaming JSON body when the provider ignores stream: true" do
      site.set_setting!("ai_api_key", "k")
      client = AiWriter::Client.new(site: site)
      allow(client).to receive(:http).and_return(
        fake_http('{"choices":[{"message":{"content":"Hi there!"}}]}')
      )
      chunks = []
      client.stream_chat([ { role: "user", content: "hi" } ]) { |d| chunks << d }
      expect(chunks).to eq([ { content: "Hi there!" } ])
    end

    it "raises a friendly Error on a non-2xx response" do
      site.set_setting!("ai_api_key", "k")
      client = AiWriter::Client.new(site: site)
      response = Object.new
      response.define_singleton_method(:is_a?) { |_klass| false }
      response.define_singleton_method(:code) { "401" }
      response.define_singleton_method(:body) { '{"error":"bad key"}' }
      http = Object.new
      http.define_singleton_method(:request) { |_req, &b| b.call(response) }
      allow(client).to receive(:http).and_return(http)

      expect { client.stream_chat([ { role: "user", content: "hi" } ]) { } }
        .to raise_error(AiWriter::Client::Error, /401/)
    end

    def tool_fake_http(sse_bodies)
      http = Object.new
      http.define_singleton_method(:request) do |_req, &block|
        response = Object.new
        response.define_singleton_method(:is_a?) { |klass| klass == Net::HTTPSuccess }
        response.define_singleton_method(:read_body) { |&b| b.call(sse_bodies.shift) }
        block.call(response)
      end
      http
    end

    def sse_tool_call(id, name, arguments)
      %(data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"#{id}","type":"function","function":{"name":"#{name}","arguments":"#{arguments.to_json.gsub('"', '\\"')}"}}]}}]}\n\n)
    end

    def sse_content(text)
      %(data: {"choices":[{"delta":{"content":"#{text}"}}]}\n\ndata: [DONE]\n\n)
    end

    it "runs a tool-calling loop, executes the tools, then yields the final answer" do
      site.set_setting!("ai_api_key", "k")
      client = AiWriter::Client.new(site: site)
      allow(client).to receive(:http).and_return(tool_fake_http([
        sse_tool_call("call_1", "search_designs", { "query" => "dark fintech" }),
        sse_content("Here is the design.")
      ]))
      executed = []
      chunks = []
      tools = [ { "type" => "function", "function" => { "name" => "search_designs", "parameters" => {} } } ]
      client.stream_chat([ { role: "user", content: "design it" } ],
                         tools: tools,
                         tool_executor: ->(name, args) { executed << [ name, args ]; "RESULT" }) { |d| chunks << d }
      expect(executed).to eq([ [ "search_designs", { "query" => "dark fintech" } ] ])
      expect(chunks).to eq([ { content: "Here is the design." } ])
    end

    it "feeds an executor error string back as a tool result so the loop can recover" do
      site.set_setting!("ai_api_key", "k")
      client = AiWriter::Client.new(site: site)
      allow(client).to receive(:http).and_return(tool_fake_http([
        sse_tool_call("c1", "get_design", {}),
        sse_content("Recovered.")
      ]))
      chunks = []
      client.stream_chat([ { role: "user", content: "go" } ],
                         tools: [ { "type" => "function", "function" => { "name" => "get_design" } } ],
                         tool_executor: ->(_n, _a) { "MCP tool error: boom" }) { |d| chunks << d }
      expect(chunks).to eq([ { content: "Recovered." } ])
    end

    it "bails out when the model never stops calling tools" do
      site.set_setting!("ai_api_key", "k")
      client = AiWriter::Client.new(site: site)
      loop_response = sse_tool_call("c1", "search_designs", {})
      allow(client).to receive(:http).and_return(tool_fake_http(Array.new(20, loop_response)))
      expect {
        client.stream_chat([ { role: "user", content: "go" } ],
                           tools: [ { "type" => "function", "function" => { "name" => "search_designs" } } ],
                           tool_executor: ->(_n, _a) { "again" }) { |_d| }
      }.to raise_error(AiWriter::Client::Error, /tool-calling rounds/)
    end
  end

  describe AiWriter::McpClient do
    let(:mcp) { AiWriter::McpClient.new(url: "https://www.designmd.co/api/mcp", token: "secret") }

    def stub_mcp_result(result_payload)
      allow(mcp).to receive(:post).with(hash_including("method" => "initialize")).and_return({ "result" => { "protocolVersion" => "2025-03-26" } })
      allow(mcp).to receive(:post).with(hash_including("method" => "notifications/initialized")).and_return({})
      allow(mcp).to receive(:post).with(hash_including("method" => "tools/list")).and_return({ "result" => { "tools" => [] } })
      allow(mcp).to receive(:post).with(hash_including("method" => "tools/call")).and_return(result_payload)
    end

    it "lists the server's tools as OpenAI function schemas" do
      allow(mcp).to receive(:post).with(hash_including("method" => "initialize")).and_return({ "result" => { "protocolVersion" => "2025-03-26" } })
      allow(mcp).to receive(:post).with(hash_including("method" => "notifications/initialized")).and_return({})
      allow(mcp).to receive(:post).with(hash_including("method" => "tools/list")).and_return(
        { "result" => { "tools" => [
          { "name" => "search_designs", "description" => "Search the catalog", "inputSchema" => { "type" => "object", "properties" => { "query" => { "type" => "string" } } } }
        ] } }
      )

      tools = mcp.tools
      expect(tools.first["type"]).to eq("function")
      expect(tools.first["function"]["name"]).to eq("search_designs")
      expect(tools.first["function"]["parameters"]["properties"]).to have_key("query")
    end

    it "calls a tool and returns its text content" do
      stub_mcp_result({ "result" => { "content" => [ { "type" => "text", "text" => "Binance: dark fintech, #FCD535" } ] } })
      expect(mcp.call("search_designs", { "query" => "dark" })).to include("Binance")
    end

    it "raises a friendly Error on a non-2xx response (bad token)" do
      allow(mcp).to receive(:post).and_raise(AiWriter::McpClient::Error, "MCP request failed (401): Missing Authorization")
      expect { mcp.tools }.to raise_error(AiWriter::McpClient::Error, /401/)
    end

    it "raises a friendly Error when the server reports an MCP error" do
      stub_mcp_result({ "result" => { "content" => [ { "type" => "text", "text" => "need pro" } ], "isError" => true } })
      expect { mcp.call("install_block", { "slug" => "x" }) }.to raise_error(AiWriter::McpClient::Error, /need pro/)
    end
  end

  it "passes MCP research tools to the model when design research is enabled" do
    site.set_setting!("ai_api_key", "k")
    site.set_setting!("mcp_enabled", "1")
    site.set_setting!("mcp_token", "t")
    site.set_setting!("mcp_url", "https://www.designmd.co/api/mcp")
    mcp = instance_double(AiWriter::McpClient)
    allow(AiWriter::McpClient).to receive(:new).and_return(mcp)
    allow(mcp).to receive(:tools).and_return([ { "type" => "function", "function" => { "name" => "search_designs", "parameters" => {} } } ])
    allow(mcp).to receive(:call).with("search_designs", { "query" => "dark" }).and_return("Binance: dark fintech")
    allow(mcp).to receive(:call).with("get_skill", hash_including("name" => "designmd")).and_return("DesignMD methodology")
    allow(mcp).to receive(:call).with("get_skill", hash_including("name" => "fundamentals")).and_return("Design fundamentals")

    captured = {}
    client = instance_double(AiWriter::Client, configured?: true)
    allow(client).to receive(:stream_chat) do |_messages, system:, tools:, tool_executor:, &block|
      captured[:tools] = tools
      captured[:hint] = system.include?("DESIGN RESEARCH")
      captured[:skills] = system.include?("Design skill: designmd") && system.include?("Design skill: fundamentals")
      captured[:research] = tool_executor.call("search_designs", { "query" => "dark" })
      block.call("ok")
    end
    allow(AiWriter::Client).to receive(:new).with(site: site).and_return(client)

    post "/plugins/ai_writer/chat", params: { mode: "design", env: "html", prompt: "build a landing page", blocks: [] }

    expect(response).to have_http_status(:ok)
    expect(captured[:hint]).to be true
    expect(captured[:skills]).to be true
    tool_names = captured[:tools].map { |t| t["function"]["name"] }
    expect(tool_names).to include("search_designs") # design research tools
    expect(tool_names).to include("edit_element")   # editing tools
    expect(captured[:research]).to eq("Binance: dark fintech")
  end

  it "injects a chosen brand's researched design system into the prompt" do
    site.set_setting!("ai_api_key", "k")
    site.set_setting!("mcp_enabled", "1")
    site.set_setting!("mcp_token", "t")
    mcp = instance_double(AiWriter::McpClient)
    allow(AiWriter::McpClient).to receive(:new).and_return(mcp)
    allow(mcp).to receive(:tools).and_return([])
    allow(mcp).to receive(:call).with("get_skill", hash_including("name" => "designmd")).and_return("methodology")
    allow(mcp).to receive(:call).with("get_skill", hash_including("name" => "fundamentals")).and_return("fundamentals")
    allow(mcp).to receive(:call).with("get_design", { "slug" => "linear.app" }).and_return("# Linear design system\nNear-black canvas, lavender accent #5e6ad2")
    allow(mcp).to receive(:call).with("generate_css_variables", { "slug" => "linear.app" }).and_return(":root { --background: #010102; }")

    captured = nil
    client = instance_double(AiWriter::Client, configured?: true)
    allow(client).to receive(:stream_chat) do |messages, system:, tools:, tool_executor:, &block|
      captured = { messages: messages, system: system, tools: tools, executor: tool_executor }
      block.call("REPLY: ok")
    end
    allow(AiWriter::Client).to receive(:new).with(site: site).and_return(client)

    post "/plugins/ai_writer/chat", params: { mode: "design", env: "html", prompt: "build me a landing", brand: "linear.app", blocks: [] }

    prompt = captured[:messages].last[:content]
    expect(prompt).to include("DESIGN WITH THE AESTHETIC OF \"linear.app\"")
    expect(prompt).to include("--background: #010102")
    expect(prompt).to include("--pb-accent")
    expect(captured[:system]).to include("Design skill: designmd")
    expect(captured[:system]).to include("Design skill: fundamentals")
  end

  describe AiWriter::Design do
    def sample_design
      AiWriter::Design.new([
        { "bg" => "#ffffff", "elements" => [
          { "name" => "H5Element", "template" => "H5", "text" => "Label" },
          { "name" => "H1Element", "template" => "H1", "text" => "Old headline" }
        ] },
        { "bg" => "#f3f4f6", "elements" => [ { "name" => "PElement", "template" => "P", "text" => "Body" } ] }
      ])
    end

    it "edits an element's text in place without touching the rest" do
      d = sample_design
      d.apply_tool("edit_element", { "section" => 0, "element" => 1, "field" => "text", "value" => "New headline" })
      expect(d.sections[0]["elements"][1]["text"]).to eq("New headline")
      expect(d.sections[0]["elements"][0]["text"]).to eq("Label")
      expect(d.sections.length).to eq(2)
    end

    it "inserts a new section after a target section" do
      d = sample_design
      d.apply_tool("add_section", { "after" => 0, "bg" => "#eef2ff", "elements" => [ { "type" => "H1", "text" => "Testimonials" } ] })
      expect(d.sections.length).to eq(3)
      expect(d.sections[1]["bg"]).to eq("#eef2ff")
      expect(d.sections[1]["elements"].first["text"]).to eq("Testimonials")
      expect(d.sections[1]["elements"].first["name"]).to eq("H1Element")
      expect(d.sections[2]["elements"].first["text"]).to eq("Body")
    end

    it "appends when 'after' is omitted or -1" do
      d = sample_design
      d.apply_tool("add_section", { "elements" => [ { "type" => "P", "text" => "Tail" } ] })
      d.apply_tool("add_section", { "after" => -1, "bg" => "#111", "elements" => [ { "type" => "BUTTON", "text" => "Go" } ] })
      expect(d.sections.length).to eq(4)
      expect(d.sections.last["bg"]).to eq("#111")
    end

    it "removes sections and elements" do
      d = sample_design
      d.apply_tool("remove_element", { "section" => 0, "element" => 0 })
      expect(d.sections[0]["elements"].length).to eq(1)
      d.apply_tool("remove_section", { "section" => 1 })
      expect(d.sections.length).to eq(1)
    end

    it "sets custom css/js and reports them in the spec" do
      d = sample_design
      d.apply_tool("set_custom_css", { "css" => ":root { --cp-accent: #5e6ad2 }" })
      d.apply_tool("set_custom_js", { "js" => "console.log(1)" })
      spec = d.to_spec
      expect(spec["elementLists"].length).to eq(2)
      expect(spec["customCss"]).to include("--cp-accent")
      expect(spec["customJs"]).to eq("console.log(1)")
    end

    it "seeds the working copy with the page's current custom css" do
      d = AiWriter::Design.new(sample_design.sections, custom_css: ":root { --cp-accent: #2563eb; }")
      d.apply_tool("css_edit", { "selector" => ":root", "property" => "--cp-accent", "value" => "#5e6ad2" })
      expect(d.custom_css).to include("--cp-accent: #5e6ad2")
      expect(d.custom_css).not_to include("#2563eb")
    end

    it "css_edit updates an existing declaration without touching the rest of the stylesheet" do
      d = AiWriter::Design.new([], custom_css: ".cp-btn-primary { background: #111827; color: #fff; }\n.cp-lead { color: #4b5563; }")
      d.apply_tool("css_edit", { "selector" => ".cp-btn-primary", "property" => "background", "value" => "#5e6ad2" })
      expect(d.custom_css).to include(".cp-btn-primary { background: #5e6ad2; color: #fff; }")
      expect(d.custom_css).to include(".cp-lead { color: #4b5563; }")
    end

    it "css_edit appends a new rule when the selector does not exist" do
      d = AiWriter::Design.new([], custom_css: ".cp-lead { color: #4b5563; }")
      d.apply_tool("css_edit", { "selector" => ".cp-card", "property" => "border-radius", "value" => "8px" })
      expect(d.custom_css).to include(".cp-card {")
      expect(d.custom_css).to include("border-radius: 8px;")
      expect(d.custom_css).to include(".cp-lead { color: #4b5563; }")
    end

    it "read_design returns the grep-style index" do
      text = sample_design.apply_tool("read_design", {})
      expect(text).to include("[0] section bg=#ffffff")
      expect(text).to include("[1] h1: Old headline")
      expect(text).to include("[0] p: Body")
    end

    it "read_section returns one section's elements" do
      text = sample_design.apply_tool("read_section", { "section" => 1 })
      expect(text).to include("bg=#f3f4f6")
      expect(text).to include("p: Body")
      expect(text).not_to include("Old headline")
    end

    it "read_css returns a matching rule or the whole stylesheet" do
      d = AiWriter::Design.new([], custom_css: ".cp-btn-primary { background: #111827; }\n.cp-lead { color: #4b5563; }")
      expect(d.apply_tool("read_css", { "selector" => ".cp-btn-primary" })).to include(".cp-btn-primary { background: #111827; }")
      expect(d.apply_tool("read_css", { "selector" => ".nope" })).to include("no rule for selector")
      expect(d.apply_tool("read_css", { "selector" => "*" })).to include(".cp-lead")
    end
  end

  it "always includes the current design sections so precision edits can target elements" do
    site.set_setting!("ai_api_key", "k")
    captured = nil
    client = instance_double(AiWriter::Client, configured?: true)
    allow(client).to receive(:stream_chat) do |messages, system:, tools:, tool_executor:, &block|
      captured = messages.last[:content]
      block.call("ok")
    end
    allow(AiWriter::Client).to receive(:new).with(site: site).and_return(client)

    post "/plugins/ai_writer/chat", params: {
      mode: "design", env: "html", prompt: "change the headline", blocks: [],
      currentSections: [ { "bg" => "#ffffff", "elements" => [ { "name" => "H1Element", "text" => "Old headline" } ] } ]
    }, as: :json

    expect(captured).to include("Current design (grep-style index")
    expect(captured).to include("h1: Old headline")
    expect(captured).to include("TASK: design as requested")
  end

  it "skips MCP research tools but keeps the editing tools when design research is disabled" do
    site.set_setting!("ai_api_key", "k")
    site.set_setting!("mcp_enabled", "0")
    captured = nil
    client = instance_double(AiWriter::Client, configured?: true)
    allow(client).to receive(:stream_chat) do |_messages, system:, tools:, tool_executor:, &block|
      captured = [ system, tools, tool_executor ]
      block.call("ok")
    end
    allow(AiWriter::Client).to receive(:new).with(site: site).and_return(client)

    post "/plugins/ai_writer/chat", params: { mode: "draft", prompt: "hi", blocks: [] }

    expect(captured).not_to be_nil
    expect(captured[1].map { |t| t["function"]["name"] }).not_to include("search_designs")
    expect(captured[1].map { |t| t["function"]["name"] }).to include("add_section")
    expect(captured[2]).not_to be_nil
    expect(captured[0]).not_to include("DESIGN RESEARCH")
  end

  it "streams the updated design back when the model uses the editing tools" do
    site.set_setting!("ai_api_key", "k")
    captured_tools = nil
    client = instance_double(AiWriter::Client, configured?: true)
    allow(client).to receive(:stream_chat) do |_messages, system:, tools:, tool_executor:, &block|
      captured_tools = tools
      tool_executor.call("add_section", { "after" => 0, "bg" => "#eef2ff", "elements" => [ { "type" => "H1", "text" => "Testimonials" } ] })
      block.call("Added a testimonials section.")
    end
    allow(AiWriter::Client).to receive(:new).with(site: site).and_return(client)

    post "/plugins/ai_writer/chat", params: {
      mode: "design", env: "html", prompt: "add a testimonials section after the hero", blocks: [],
      currentSections: [
        { "bg" => "#ffffff", "elements" => [ { "name" => "H1Element", "template" => "H1", "text" => "Hero" } ] },
        { "bg" => "#f3f4f6", "elements" => [ { "name" => "PElement", "template" => "P", "text" => "Body" } ] }
      ]
    }, as: :json

    expect(response).to have_http_status(:ok)
    expect(captured_tools.map { |t| t["function"]["name"] }).to include("add_section")
    expect(response.body).to include("Added a testimonials section.")

    design_line = response.body.lines.find { |l| l.include?('"design"') }
    expect(design_line).not_to be_nil
    payload = JSON.parse(design_line.delete_prefix("data:").strip)
    expect(payload["design"]["elementLists"].length).to eq(3)
    expect(payload["design"]["elementLists"][1]["elements"].first["text"]).to eq("Testimonials")
    expect(payload["design"]["elementLists"][0]["elements"].first["text"]).to eq("Hero") # untouched
  end

  it "returns generated markdown from the provider" do
    client = instance_double(AiWriter::Client, configured?: true)
    allow(client).to receive(:generate).with(/Write an intro/).and_return("# Draft\n\nSome **body** text.")
    allow(AiWriter::Client).to receive(:new).with(site: site).and_return(client)

    post "/plugins/ai_writer/write", params: { prompt: "Write an intro about Ruby", context: "Rails in practice" }, as: :json

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq("markdown" => "# Draft\n\nSome **body** text.")
  end

  it "returns a friendly error when AI is not configured" do
    client = instance_double(AiWriter::Client, configured?: false)
    allow(AiWriter::Client).to receive(:new).with(site: site).and_return(client)

    post "/plugins/ai_writer/write", params: { prompt: "hi" }, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(JSON.parse(response.body)["error"]).to include("not configured")
  end

  it "renders and saves the plugin settings page" do
    get "/plugins/ai_writer/settings"
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Copilot")
    expect(response.body).to include("API base URL")

    post "/plugins/ai_writer/settings", params: { ai_writer: { ai_base_url: "http://localhost:9999/v1", ai_model: "gpt-test", ai_api_key: "k123" } }
    expect(response).to redirect_to("/plugins/ai_writer/settings")
    expect(site.setting("ai_base_url")).to eq("http://localhost:9999/v1")
    expect(site.setting("ai_model")).to eq("gpt-test")
  end

  it "streams SSE chunks from the provider" do
    client = instance_double(AiWriter::Client, configured?: true)
    allow(client).to receive(:stream_chat) do |&block|
      block.call("Hel")
      block.call("lo")
    end
    allow(AiWriter::Client).to receive(:new).with(site: site).and_return(client)

    post "/plugins/ai_writer/chat", params: { mode: "draft", prompt: "hi", blocks: [] }

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("text/event-stream")
    expect(response.body).to include('data: {"choice":{"delta":{"content":"Hel"}}}')
    expect(response.body).to include("data: [DONE]")
  end

  it "returns a friendly error over SSE when AI is not configured" do
    client = instance_double(AiWriter::Client, configured?: false)
    allow(AiWriter::Client).to receive(:new).with(site: site).and_return(client)

    post "/plugins/ai_writer/chat", params: { mode: "draft", prompt: "hi" }

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("not configured")
  end
end
