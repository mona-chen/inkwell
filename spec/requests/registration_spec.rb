require "rails_helper"

RSpec.describe "Public account registration", type: :request do
  include Devise::Test::IntegrationHelpers

  let!(:site) do
    Site.create!(name: "Test Site", domain: "example.test", is_default: true, active_theme: "default")
  end

  describe "GET /users/sign_up" do
    it "renders the Ink sign-up page when registration is open" do
      get new_user_registration_path
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Create your account")
      expect(response.body).to include('name="user[name]"')
    end

    it "redirects with an alert when registration is closed" do
      site.set_setting!("registration_mode", "closed")
      get new_user_registration_path
      expect(response).to redirect_to(new_user_session_path)
      expect(flash[:alert]).to eq("Registration is currently closed.")
    end

    it "redirects with an alert when registration is invite-only" do
      site.set_setting!("registration_mode", "invite_only")
      get new_user_registration_path
      expect(response).to redirect_to(new_user_session_path)
      expect(flash[:alert]).to eq("Registration is by invitation only.")
    end
  end

  describe "POST /users" do
    it "creates a subscriber account on the current site and signs them in" do
      expect do
        post user_registration_path, params: {
          user: { name: "Maya", email: "maya@example.com", password: "password123" }
        }
      end.to change(User, :count).by(1)

      user = User.find_by(email: "maya@example.com")
      expect(user.site).to eq(site)
      expect(user.role.name).to eq("subscriber")
      expect(response).to redirect_to(root_path)
    end

    it "re-renders the form with errors for an invalid submission" do
      post user_registration_path, params: {
        user: { name: "", email: "", password: "short" }
      }
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.body).to include("We couldn")
      expect(response.body).to include("field_with_errors")
    end

    it "refuses to create an account when registration is closed" do
      site.set_setting!("registration_mode", "closed")
      expect do
        post user_registration_path, params: {
          user: { name: "Maya", email: "maya@example.com", password: "password123" }
        }
      end.not_to change(User, :count)
      expect(response).to redirect_to(new_user_session_path)
    end
  end
end
