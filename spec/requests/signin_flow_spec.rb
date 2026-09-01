require "rails_helper"

RSpec.describe "Devise sign-in flow with Nitro", type: :request do
  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  it "signs in and redirects to the admin dashboard" do
    post user_session_path, params: { user: { email: user.email, password: user.password } }
    expect(response).to have_http_status(:redirect)
    follow_redirect!
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("data-ink=\"shell\"")
  end
end
