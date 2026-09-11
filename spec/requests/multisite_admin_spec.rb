require "rails_helper"

RSpec.describe "Multisite admin + signup", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:role) { Role.create!(name: "admin") }
  let(:platform) { Site.create!(name: "Platform", domain: "inkwell.test", subdomain: nil, is_default: true) }
  let(:blog) { Site.create!(name: "Blog", domain: "blog.inkwell.test", subdomain: "blog") }
  let(:super_admin) { User.create!(name: "Aaliyah", email: "aaliyah@inkwell.test", password: "password123", site: platform, role: role) }

  before do
    Multisite::UserSite.create!(user: super_admin, site: platform, role: "admin")
  end

  describe "GET /signup" do
    it "renders the public registration page" do
      get "/signup"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Start your site with Inkwell")
      expect(response.body).to include('name="subdomain"')
    end
  end

  describe "POST /signup" do
    it "provisions a site, signs the owner in, and redirects to their subdomain" do
      expect do
        post "/signup", params: {
          subdomain: "myblog", site_name: "My Blog",
          name: "Gen", email: "gen@example.com", password: "password123"
        }
      end.to change(Site, :count).by(1).and change(User, :count).by(1)

      site = Site.find_by(subdomain: "myblog")
      expect(site.domain).to eq("myblog.lvh.me")
      expect(site).to be_active
      expect(site.super_admin?(User.find_by(email: "gen@example.com"))).to be(true)

      expect(response).to redirect_to("http://myblog.lvh.me/plugins/multisite/onboarding")
    end

    it "rejects a reserved subdomain" do
      post "/signup", params: {
        subdomain: "admin", site_name: "Admin",
        name: "Gen", email: "gen@example.com", password: "password123"
      }
      expect(response).to have_http_status(:ok)
      expect(Site.find_by(subdomain: "admin")).to be_nil
    end

    it "rejects a duplicate email with the existing account sign-in hint" do
      User.create!(name: "Existing", email: "gen@example.com", password: "password123", site: platform, role: role)
      post "/signup", params: {
        subdomain: "fresh", site_name: "Fresh",
        name: "Gen", email: "gen@example.com", password: "password123"
      }
      expect(response.body).to include("already exists")
      expect(Site.find_by(subdomain: "fresh")).to be_nil
    end
  end

  describe "site switcher" do
    before { sign_in super_admin }

    it "switches the current site and persists the choice in the session" do
      post engine.admin_site_switcher_path(site_id: blog.id)
      expect(response).to redirect_to("/admin")
      expect(session["multisite.site_id"]).to eq(blog.id)
    end
  end

  describe "admin site management" do
    before { sign_in super_admin }

    it "lists sites and forbids non-super-admins" do
      get engine.admin_sites_path
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Sites")
    end

    it "blocks non-super-admins from the site admin" do
      editor_role = Role.create!(name: "editor")
      editor = User.create!(name: "Mason", email: "mason@example.com", password: "password123", site: blog, role: editor_role)
      sign_in editor
      get engine.admin_sites_path
      expect(response).to redirect_to("/")
    end
  end

  describe "per-site plugin activation" do
    before { sign_in super_admin }

    it "lets the creator toggle plugin mode between per-site and global" do
      post engine.set_mode_admin_site_plugins_path(blog), params: { mode: "global" }
      expect(blog.reload.settings.fetch("plugins_mode")).to eq("global")

      post engine.set_mode_admin_site_plugins_path(blog), params: { mode: "per_site" }
      expect(blog.reload.settings.fetch("plugins_mode")).to eq("per_site")
    end

    it "lets the creator enable/disable a plugin for a site" do
      plugin = InstalledPlugin.create!(slug: "test_admin_plugin", name: "Test Admin Plugin", version: "1.0", active: true)
      post engine.deactivate_admin_site_plugin_path(blog, plugin.slug)
      expect(blog.plugin_activations.find_by(installed_plugin_id: plugin).active).to be(false)

      post engine.activate_admin_site_plugin_path(blog, plugin.slug)
      expect(blog.plugin_activations.find_by(installed_plugin_id: plugin).active).to be(true)
    end
  end

  # Routes are scoped to the engine mount (/plugins/multisite), so they must be exercised
  # via Multisite::Engine.routes.url_helpers rather than the app's helpers.
  def engine
    Multisite::Engine.routes.url_helpers
  end
end
