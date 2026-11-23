require "rails_helper"

RSpec.describe "Author profiles", type: :request do
  include Devise::Test::IntegrationHelpers
  let!(:site) { Site.create!(name: "Profile site", domain: "profile.test", is_default: true, active_theme: "default") }
  let!(:admin_role) { Role.create!(name: "admin", capabilities: Role::CAPABILITIES) }
  let!(:author_role) { Role.create!(name: "author", capabilities: %w[upload_media]) }
  let!(:admin) { User.create!(name: "Site Admin", email: "profile-admin@test.example", password: "password123", role: admin_role, site: site) }
  let!(:author) { User.create!(name: "Ada Obi", email: "ada@test.example", password: "password123", role: author_role, site: site) }

  it "lets any author edit their own public profile" do
    sign_in author
    get admin_profile_path
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Your profile", "Public profile", "Written by")

    patch admin_profile_path, params: { user: { name: "Ada Obi", job_title: "Head of Support", bio: "Ada writes about support.", profile_links: [ { label: "", url: "linkedin.com/in/ada" }, { label: "", url: "" } ] } }
    expect(response).to redirect_to(admin_profile_path)
    author.reload
    expect(author.job_title).to eq("Head of Support")
    expect(author.profile_links).to eq([ { "kind" => "linkedin", "label" => "LinkedIn", "url" => "https://linkedin.com/in/ada" } ])
  end

  it "rejects unsafe links and keeps the form" do
    sign_in author
    patch admin_profile_path, params: { user: { name: "Ada", profile_links: [ { url: "javascript:alert(1)" } ] } }
    expect(response).to have_http_status(:unprocessable_entity)
    expect(author.reload.profile_links).to eq([])
  end

  it "changes the password only with the current password" do
    sign_in author
    patch admin_profile_path, params: { user: { name: "Ada", current_password: "wrong", password: "newpass123", password_confirmation: "newpass123" } }
    expect(response).to have_http_status(:unprocessable_entity)
    patch admin_profile_path, params: { user: { name: "Ada", current_password: "password123", password: "newpass123", password_confirmation: "newpass123" } }
    expect(author.reload.valid_password?("newpass123")).to be(true)
  end

  it "lets admins edit other authors but not authors edit others" do
    sign_in admin
    patch admin_profile_path(author: author.to_param), params: { user: { name: "Ada Obi", job_title: "Editor" } }
    expect(author.reload.job_title).to eq("Editor")

    sign_in author
    get admin_profile_path(author: admin.to_param)
    expect(response).to have_http_status(:not_found)
  end
end
