require "rails_helper"

RSpec.describe "Public admin bar", type: :request do
  include Devise::Test::IntegrationHelpers

  let!(:site) { Site.create!(name: "Test Site", domain: "example.test", is_default: true, active_theme: "default") }
  let(:role) { Role.create!(name: "admin") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  it "shows a signed-in bar to authenticated visitors" do
    sign_in user
    get root_path
    expect(response).to have_http_status(:ok)
    expect(response.body).to include('data-ink="admin-bar"')
    expect(response.body).to include("Signed in")
    expect(response.body).to include("Dashboard")
  end

  it "does not show the bar to anonymous visitors" do
    get root_path
    expect(response.body).not_to include('data-ink="admin-bar"')
  end
end
