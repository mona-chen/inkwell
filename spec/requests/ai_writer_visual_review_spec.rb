require "rails_helper"

RSpec.describe "AiWriter visual design review", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:site) { Site.create!(name: "S", domain: "s.test") }
  let(:role) { Role.create!(name: "admin") }
  let(:user) { User.create!(name: "A", email: "a@example.com", password: "password123", site: site, role: role) }

  # A snapshot only ever travels as a same-origin JPEG data URL; anything else is not a capture.
  let(:snapshot) { "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD" }

  before { sign_in user }

  it "reports that the review is off until the site names an image-capable model" do
    post "/plugins/ai_writer/visual_review", params: { image: snapshot, brief: "hero" }, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body["ok"]).to be(false)
    expect(body["visually_reviewed"]).to be(false)
    expect(body["error"]).to include("not configured")
  end

  it "refuses anything that is not a bounded JPEG snapshot" do
    site.set_setting!("ai_review_model", "vision-model")
    site.set_setting!("ai_api_key", "sk-test")

    post "/plugins/ai_writer/visual_review", params: { image: "https://evil.test/x.png", brief: "hero" }, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(JSON.parse(response.body)["error"]).to include("JPEG")
  end

  def fake_http(klass, code, body)
    response = klass.new("1.0", code, "reason")
    response.instance_variable_set(:@body, body)
    response.instance_variable_set(:@read, true)
    instance_double(Net::HTTP, post: response)
  end

  it "returns the reviewer's critique for a real capture" do
    site.set_setting!("ai_review_model", "vision-model")
    site.set_setting!("ai_api_key", "sk-test")
    http = fake_http(Net::HTTPOK, "200", { choices: [ { message: { content: "Hero headline is clipped; widen the measure." } } ] }.to_json)
    allow_any_instance_of(AiWriter::VisualReviewClient).to receive(:http).and_return(http)

    post "/plugins/ai_writer/visual_review", params: { image: snapshot, brief: "hero", viewport: "desktop · 1440px · full page" }, as: :json

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["ok"]).to be(true)
    expect(body["visually_reviewed"]).to be(true)
    expect(body["critique"]).to include("clipped")
  end

  # A provider refusal (bad key, unknown model) must read as that refusal, never as a design flaw.
    it "passes the provider's own words back when the review call fails" do
    site.set_setting!("ai_review_model", "vision-model")
    site.set_setting!("ai_api_key", "sk-wrong")
    http = fake_http(Net::HTTPUnauthorized, "401", { error: { message: "Incorrect API key provided" } }.to_json)
    allow_any_instance_of(AiWriter::VisualReviewClient).to receive(:http).and_return(http)

    post "/plugins/ai_writer/visual_review", params: { image: snapshot, brief: "hero" }, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
    expect(JSON.parse(response.body)["error"]).to include("Incorrect API key provided")
  end
end
