require "rails_helper"

RSpec.describe "Site creation policy", type: :request do
  include Devise::Test::IntegrationHelpers

  let!(:platform) { Site.create!(name: "Platform", domain: "example.test", is_default: true, active_theme: "default") }

  describe "Multisite::Settings.site_creation_mode" do
    it "defaults to open" do
      expect(Multisite::Settings.site_creation_mode).to eq("open")
      expect(Multisite::Settings.site_creation_open?).to be(true)
    end

    it "persists a valid mode on the platform site" do
      Multisite::Settings.site_creation_mode = "closed"
      expect(Multisite::Settings.site_creation_mode).to eq("closed")
      expect(platform.reload.setting("site_creation_mode")).to eq("closed")
    end

    it "rejects an invalid mode" do
      expect { Multisite::Settings.site_creation_mode = "nonsense" }.to raise_error(ArgumentError)
    end
  end

  describe "GET /signup" do
    it "renders when site creation is open" do
      get "/signup"
      expect(response).to have_http_status(:ok)
    end

    it "redirects when site creation is closed" do
      Multisite::Settings.site_creation_mode = "closed"
      get "/signup"
      expect(response).to redirect_to(root_path)
      expect(flash[:alert]).to eq("Site creation is currently closed.")
    end

    it "redirects when site creation is invite-only" do
      Multisite::Settings.site_creation_mode = "invite_only"
      get "/signup"
      expect(response).to redirect_to(root_path)
      expect(flash[:alert]).to eq("Site creation is by invitation only.")
    end
  end
end
