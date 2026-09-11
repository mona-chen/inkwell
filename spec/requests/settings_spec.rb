require "rails_helper"

RSpec.describe "Settings save", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }
  let(:user) { User.create!(name: "Admin", email: "admin@example.com", password: "password123", site: site, role: role) }

  before { sign_in user }

  it "persists settings submitted under settings[] (the scoped name the form renders)" do
    patch admin_settings_path, params: { settings: { name: "Scoped", tagline: "Hello" } }
    expect(site.reload.name).to eq("Scoped")
    expect(site.setting("tagline")).to eq("Hello")
  end

  it "renders the settings form with scoped settings[...] field names" do
    get admin_settings_path
    expect(response.body).to include('name="settings[name]"')
    expect(response.body).to include('name="settings[tagline]"')
  end
end
