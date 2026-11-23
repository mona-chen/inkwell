require "rails_helper"

RSpec.describe "Site-scoped sign in", type: :request do
  let!(:site) { Site.create!(name: "Login site", domain: "login.lvh.me", is_default: true) }
  let(:role) { Role.find_or_create_by!(name: "editor") }
  let!(:user) { User.create!(name: "Test editor", email: "editor@example.test", password: "password123", site: site, role: role) }

  before { host! site.domain }
  after { Current.reset }

  it "rejects an unknown email without raising a server error" do
    post user_session_path, params: { user: { email: "unknown@example.test", password: "password123" } }

    expect(response).to have_http_status(:unprocessable_content)
    expect(response.body).to include("Invalid email or password")
  end

  it "rejects an unknown email from the Turbo login form without a server error" do
    post user_session_path, params: { user: { email: "unknown@example.test", password: "password123" } },
                            headers: { "Accept" => "text/vnd.turbo-stream.html" }

    expect(response).to have_http_status(:unprocessable_content)
  end

  it "signs in a non-admin on their primary site without a separate site grant" do
    post user_session_path, params: { user: { email: user.email, password: "password123" } }

    expect(response).to redirect_to(root_path)
    expect(request.env["warden"].user).to eq(user)
  end

  it "rejects an incorrect password for an existing user" do
    post user_session_path, params: { user: { email: user.email, password: "wrong-password" } }

    expect(response).to have_http_status(:unprocessable_content)
    expect(request.env["warden"].user).to be_nil
  end

  it "accepts a user explicitly granted access to the current site" do
    other_site = Site.create!(name: "Granted site", domain: "granted.lvh.me")
    Multisite::UserSite.create!(user: user, site: other_site, role: "editor")
    host! other_site.domain

    post user_session_path, params: { user: { email: user.email, password: "password123" } }

    expect(response).to redirect_to(root_path)
    expect(request.env["warden"].user).to eq(user)
  end

  it "does not let valid credentials access a different site without a grant" do
    other_site = Site.create!(name: "Other site", domain: "other.lvh.me")
    host! other_site.domain

    post user_session_path, params: { user: { email: user.email, password: "password123" } }

    expect(response).to have_http_status(:unprocessable_content)
    expect(request.env["warden"].user).to be_nil
  end
end
