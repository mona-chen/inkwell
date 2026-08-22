require "rails_helper"

RSpec.describe "AiWriter client-driven Copilot relay", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:site) { Site.create!(name: "S", domain: "s.test") }
  let(:role) { Role.create!(name: "admin") }
  let(:user) { User.create!(name: "A", email: "a@example.com", password: "password123", site: site, role: role) }

  before do
    sign_in user
    allow_any_instance_of(AiWriter::Client).to receive(:configured?).and_return(true)
  end

  it "chat (clientTools) streams a relayed tool call for the browser to execute" do
    calls = [{ "id" => "call_1", "type" => "function", "function" => { "name" => "insert_element", "arguments" => '{"type":"heading"}' } }]
    allow_any_instance_of(AiWriter::Client).to receive(:stream_round).and_wrap_original do |_orig, *_args, &blk|
      blk&.call({ tool_calls: calls })
      { role: "assistant", content: nil, tool_calls: calls }
    end

    post "/plugins/ai_writer/chat", params: {
      clientTools: true, prompt: "add a heading", mode: "design", designIndex: "(empty page)",
      tools: [].to_json
    }, as: :json

    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include('data: {"tools":{"session_id":')
    expect(body).to include('"name":"insert_element"')
    expect(body).to include("data: [DONE]")
  end

  it "tool_result resumes the session and completes when the model stops calling tools" do
    # Seed a session as the first round would.
    session_id = "relay_test_session"
    AiWriter::CompletionsController::CLIENT_SESSIONS[session_id] = {
      messages: [{ role: "user", content: "design a page" }], created_at: Time.now
    }
    allow_any_instance_of(AiWriter::Client).to receive(:stream_round) do |_client, *_args, &blk|
      blk&.call({ content: "Done — the page is ready." })
      { role: "assistant", content: "Done — the page is ready." }
    end

    post "/plugins/ai_writer/tool_result", params: {
      session_id: session_id,
      results: [{ id: "call_1", content: "ok — added heading" }],
      tools: [].to_json
    }, as: :json

    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("Done — the page is ready.")
    expect(body).to include("data: [DONE]")
    expect(AiWriter::CompletionsController::CLIENT_SESSIONS).not_to have_key(session_id)
  ensure
    AiWriter::CompletionsController::CLIENT_SESSIONS.delete(session_id)
  end

  it "tool_result reports an expired session" do
    post "/plugins/ai_writer/tool_result", params: {
      session_id: "missing", results: [], tools: [].to_json
    }, as: :json

    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Copilot session expired")
  end
end
