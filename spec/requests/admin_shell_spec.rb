require "rails_helper"

RSpec.describe "Admin shell renders", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  before { sign_in user }

  it "renders the admin dashboard with the Nitro shell" do
    get admin_root_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-nk=\"app-shell\"")
    expect(body).to include("Inkwell")
  end
end
