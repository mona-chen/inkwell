require "rails_helper"

RSpec.describe "Proper 404s", type: :request do
  let(:role) { Role.create!(name: "admin") }
  let(:site) { Site.create!(name: "Test Site", domain: "example.test") }

  before { allow(Current).to receive(:site).and_return(site) }

  it "renders the themed 404 for a missing post slug" do
    get "/posts/hello-inkwell"
    expect(response).to have_http_status(:not_found)
    expect(response.body).to include("This page wandered off")
    expect(response.body).to include("Back home")
    expect(response.body).not_to include("ActiveRecord::RecordNotFound")
  end

  it "renders the themed 404 for a missing page slug" do
    get "/pages/nope"
    expect(response).to have_http_status(:not_found)
    expect(response.body).to include("This page wandered off")
  end

  it "returns a bare 404 for JSON/API requests" do
    get "/posts/hello-inkwell", headers: { "Accept" => "application/json" }
    expect(response).to have_http_status(:not_found)
    expect(response.body).to be_blank
  end

  it "renders the themed 404 for a post whose URL exists but is unpublished" do
    user = User.create!(name: "A", email: "a@example.com", password: "password123", site: site, role: role)
    post = Post.create!(title: "Hidden", slug: "hidden-draft", site: site, author: user, status: "draft")

    get "/posts/hidden-draft"
    expect(response).to have_http_status(:not_found)
  end
end
