require "rails_helper"

RSpec.describe "Admin user management", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  before { sign_in user }

  it "lists users with roles and deactivate controls" do
    get admin_users_path
    expect(response).to have_http_status(:ok)
    expect(response.body).to include("Accounts")
    expect(response.body).to include("Add user")
  end

  it "creates a user in a chosen role" do
    editor = Role.create!(name: "editor")
    post admin_users_path, params: { name: "Maya", email: "maya@example.com", password: "secret123", role_id: editor.id }
    expect(response).to redirect_to(admin_users_path)
    created = site.users.find_by(email: "maya@example.com")
    expect(created).to be_present
    expect(created.role).to eq(editor)
  end

  it "deactivates a user (soft delete) and reactivates them" do
    target = User.create!(name: "Maya", email: "maya@example.com", password: "secret123", site: site, role: role)
    post deactivate_admin_user_path(target)
    expect(target.reload).to be_deactivated
    expect(site.users.count).to eq(2) # still a row, just deactivated

    post reactivate_admin_user_path(target)
    expect(target.reload).not_to be_deactivated
  end

  it "does not let a user deactivate themselves" do
    post deactivate_admin_user_path(user)
    expect(user.reload).not_to be_deactivated
  end
end
