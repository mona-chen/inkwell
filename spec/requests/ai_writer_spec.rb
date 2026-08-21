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
      expect(chunks).to eq(%w[Hel lo])
    end

    it "falls back to a non-streaming JSON body when the provider ignores stream: true" do
      site.set_setting!("ai_api_key", "k")
      client = AiWriter::Client.new(site: site)
      allow(client).to receive(:http).and_return(
        fake_http('{"choices":[{"message":{"content":"Hi there!"}}]}')
      )
      chunks = []
      client.stream_chat([ { role: "user", content: "hi" } ]) { |d| chunks << d }
      expect(chunks).to eq([ "Hi there!" ])
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
