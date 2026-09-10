require "rails_helper"

RSpec.describe "Auth pages render with Ink", type: :request do
  it "renders the sign-in page with Ink markup" do
    get new_user_session_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-ink=\"auth-shell\"")
    expect(body).to include("data-ink=\"card\"")
    expect(body).to include("Sign in")
  end

  it "renders the password reset request page with Ink markup" do
    get new_user_password_path
    expect(response).to have_http_status(:ok)
    body = response.body
    expect(body).to include("data-ink=\"auth-shell\"")
    expect(body).to include("Reset your password")
  end
end
