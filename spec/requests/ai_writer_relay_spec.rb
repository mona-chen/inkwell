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
      expect(_args.first.first[:content]).to include("selected-card", "mobile")
      blk&.call({ tool_calls: calls })
      { role: "assistant", content: nil, tool_calls: calls }
    end

    post "/plugins/ai_writer/chat", params: {
      clientTools: true, prompt: "add a heading", mode: "design", designIndex: "(empty page)",
      editorContext: { selection: [{ id: "selected-card", type: "frame" }], device: "mobile" },
      tools: [].to_json
    }, as: :json

    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include('data: {"tools":{"session_id":')
    expect(body).to include('"name":"insert_element"')
    expect(body).to include("data: [DONE]")
  end

  # The prompt may promise only what the browser actually published. A picture tool the client
  # never sent makes the model call something the server cannot fulfil and stalls the run.
  it "describes picture tools only when the browser published them" do
    prompts = []
    allow_any_instance_of(AiWriter::Client).to receive(:stream_round) do |_client, *_args, **kwargs, &blk|
      prompts << kwargs[:system]
      blk&.call({ content: "ok" })
      { role: "assistant", content: "ok" }
    end

    post "/plugins/ai_writer/chat", params: {
      clientTools: true, prompt: "design a page", mode: "design", designIndex: "(empty page)",
      tools: [ { name: "list_media", description: "library" }, { name: "generate_image", description: "maker" } ].to_json
    }, as: :json

    post "/plugins/ai_writer/chat", params: {
      clientTools: true, prompt: "design a page", mode: "design", designIndex: "(empty page)",
      tools: [ { name: "read_design", description: "read" } ].to_json
    }, as: :json

    expect(response).to have_http_status(:ok)
    with_tools, without_tools = prompts
    expect(with_tools).to include("- IMAGES", "list_media", "generate_image", "media library")
    expect(without_tools).to include("no image search or generation tool")
    expect(without_tools).not_to include("generate_image")
  end

  it "tool_result resumes the session and completes when the model stops calling tools" do
    # Seed a session as the first round would.
    session_id = "relay_test_session"
    AiWriter::CompletionsController::CLIENT_SESSIONS[session_id] = {
      messages: [{ role: "user", content: "design a page" }], user_id: user.id, site_id: site.id, created_at: Time.now
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
    expect(AiWriter::CompletionsController::CLIENT_SESSIONS.key?(session_id)).to be(false)
  ensure
    AiWriter::CompletionsController::CLIENT_SESSIONS.delete(session_id)
  end

  it "does not resume another user's tool session" do
    session_id = "another_user_session"
    AiWriter::CompletionsController::CLIENT_SESSIONS[session_id] = {
      messages: [], user_id: user.id + 1, site_id: site.id
    }
    expect_any_instance_of(AiWriter::Client).not_to receive(:stream_round)
    post "/plugins/ai_writer/tool_result", params: { session_id: session_id, results: [] }, as: :json
    expect(response.body).to include("Copilot session expired")
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

  # The browser is handed the REAL reason a call cannot run. Turning a cut-off payload into `{}` made
  # the builder answer "replace_page requires a non-empty children array", which reads as a broken
  # tree, so the model resent the same oversized payload and the user watched nothing happen.
  it "relays a cut-off payload with its real reason instead of as an empty call" do
    calls = [ { "id" => "call_1", "type" => "function",
                "function" => { "name" => "replace_page", "arguments" => '{"children":[{"type":"frame",' } } ]
    allow_any_instance_of(AiWriter::Client).to receive(:stream_round).and_wrap_original do |_orig, *_args, &blk|
      blk&.call({ tool_calls: calls })
      { role: "assistant", content: nil, tool_calls: calls, finish_reason: "length" }
    end

    post "/plugins/ai_writer/chat", params: {
      clientTools: true, prompt: "redesign the entire page", mode: "design", designIndex: "(empty page)",
      tools: [].to_json
    }, as: :json

    expect(response).to have_http_status(:ok)
    expect(response.body).to include('"argument_error"')
    expect(response.body).to include("not valid JSON", "finish_reason: length")
    expect(response.body).not_to include('"arguments":{}')

    session_id = response.body[/"session_id":"(\h+)"/, 1]
    session = AiWriter::CompletionsController::CLIENT_SESSIONS[session_id]
    # The stop reason stays server-side: an assistant turn with an unknown key is not something every
    # OpenAI-compatible provider accepts back.
    expect(session[:messages].last).not_to have_key(:finish_reason)
  ensure
    AiWriter::CompletionsController::CLIENT_SESSIONS.delete(session_id) if session_id
  end

  # A loop the server can already see should not be paid for. An identical payload is the same
  # payload, so the second failure of the same call ends the request with an explanation.
  it "stops when the same failing call is repeated verbatim" do
    session_id = "repeat_stall_session"
    AiWriter::CompletionsController::CLIENT_SESSIONS[session_id] = {
      messages: [ { role: "user", content: "add a section" } ], user_id: user.id, site_id: site.id,
      created_at: Time.now, emitted: [ "append_tree\u001F", "append_tree\u001F" ]
    }
    expect_any_instance_of(AiWriter::Client).not_to receive(:stream_round)

    post "/plugins/ai_writer/tool_result", params: {
      session_id: session_id,
      results: [ { id: "a", content: '{"ok":false,"error":"no type"}', failed: true },
                 { id: "b", content: '{"ok":false,"error":"no type"}', failed: true } ]
    }, as: :json

    expect(response.body).to include("repeated the same failed append_tree call")
    expect(AiWriter::CompletionsController::CLIENT_SESSIONS.key?(session_id)).to be(false)
  ensure
    AiWriter::CompletionsController::CLIENT_SESSIONS.delete(session_id)
  end

  it "stops after a run of rounds in which nothing succeeded" do
    session_id = "barren_stall_session"
    AiWriter::CompletionsController::CLIENT_SESSIONS[session_id] = {
      messages: [ { role: "user", content: "add a section" } ], user_id: user.id, site_id: site.id,
      created_at: Time.now, emitted: [ "append_tree\u001F{}" ], barren_rounds: 2
    }
    expect_any_instance_of(AiWriter::Client).not_to receive(:stream_round)

    post "/plugins/ai_writer/tool_result", params: {
      session_id: session_id, results: [ { id: "a", content: '{"ok":false}', failed: true } ]
    }, as: :json

    expect(response.body).to include("rounds in a row had every tool call fail")
    expect(AiWriter::CompletionsController::CLIENT_SESSIONS.key?(session_id)).to be(false)
  ensure
    AiWriter::CompletionsController::CLIENT_SESSIONS.delete(session_id)
  end

  # The round ceiling used to be the finish line, which is how a request ended with half a page and
  # no explanation. Now the model's own "I'm done" is checked against the request and the tree first.
  it "continues the request when the judge finds the page unfinished" do
    session_id = "judge_session"
    AiWriter::CompletionsController::CLIENT_SESSIONS[session_id] = {
      messages: [ { role: "user", content: "design a landing page" } ], user_id: user.id, site_id: site.id,
      created_at: Time.now, mutated: true, request: "design a landing page", design_index: "[0] Frame"
    }
    rounds = 0
    prompts = []
    allow_any_instance_of(AiWriter::Client).to receive(:stream_round) do |_client, *args, **_kwargs, &blk|
      rounds += 1
      prompts << args.first.last[:content]
      blk&.call({ content: "Done." })
      { role: "assistant", content: "Done." }
    end
    verdicts = [ '{"complete":false,"missing":["Add the pricing section","Add the footer"]}', '{"complete":true}' ]
    allow_any_instance_of(AiWriter::Client).to receive(:generate) { verdicts.shift }

    post "/plugins/ai_writer/tool_result", params: {
      session_id: session_id, results: [ { id: "c1", content: "ok" } ], mutated: true
    }, as: :json

    expect(rounds).to eq(2)
    expect(prompts.last).to include("Add the pricing section", "Add the footer")
    expect(response.body).to include("Done.")
    expect(AiWriter::CompletionsController::CLIENT_SESSIONS.key?(session_id)).to be(false)
  ensure
    AiWriter::CompletionsController::CLIENT_SESSIONS.delete(session_id)
  end

  it "never traps the user behind a judge that answers with prose" do
    session_id = "bad_judge_session"
    AiWriter::CompletionsController::CLIENT_SESSIONS[session_id] = {
      messages: [ { role: "user", content: "design" } ], user_id: user.id, site_id: site.id,
      created_at: Time.now, mutated: true
    }
    allow_any_instance_of(AiWriter::Client).to receive(:stream_round) do |_client, *_args, **_kwargs, &blk|
      blk&.call({ content: "All set." })
      { role: "assistant", content: "All set." }
    end
    allow_any_instance_of(AiWriter::Client).to receive(:generate).and_return("Honestly, it looks lovely.")

    post "/plugins/ai_writer/tool_result", params: { session_id: session_id, results: [] }, as: :json

    expect(response.body).to include("All set.")
    expect(AiWriter::CompletionsController::CLIENT_SESSIONS.key?(session_id)).to be(false)
  ensure
    AiWriter::CompletionsController::CLIENT_SESSIONS.delete(session_id)
  end
end
