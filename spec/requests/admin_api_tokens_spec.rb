require "rails_helper"

RSpec.describe "Admin API token management", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test", is_default: true) }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  before { sign_in user }

  it "renders the API settings section" do
    get admin_settings_path(section: "api")
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Content API")
    expect(response.body).to include("/api/v1")
  end

  it "creates a token and reveals it once" do
    expect do
      post admin_api_tokens_path, params: { name: "Frontend" }
    end.to change(site.api_tokens, :count).by(1)

    expect(response).to redirect_to(admin_settings_path(section: "api"))
    follow_redirect!

    expect(response).to have_http_status(:ok)
    token = site.api_tokens.last
    expect(response.body).to include(token.token)
    expect(response.body).to include("shown again")
  end

  it "revokes a token" do
    token = site.api_tokens.create!(name: "Frontend")
    expect do
      delete admin_api_token_path(token)
    end.to change(site.api_tokens, :count).by(-1)
  end
end
