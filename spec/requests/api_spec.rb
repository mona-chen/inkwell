require "rails_helper"

RSpec.describe "Read-only JSON API", type: :request do
  let!(:site) { Site.create!(name: "Acme", domain: "example.test", is_default: true, active_theme: "default") }
  let(:role) { Role.create!(name: "admin") }
  let(:user) { User.create!(name: "Ada", email: "ada@example.com", password: "password123", site: site, role: role) }

  let!(:published) do
    site.posts.create!(title: "Hello World", slug: "hello-world", status: "published",
                       published_at: 1.day.ago, author: user, excerpt: "Hi")
  end
  let!(:draft) do
    site.posts.create!(title: "Secret Draft", slug: "secret-draft", status: "draft", author: user)
  end
  let!(:category) { site.terms.create!(name: "News", taxonomy: "category") }
  let!(:header_menu) { site.menus.create!(name: "Primary", location: "header") }

  describe "GET /api/v1/site" do
    it "returns site metadata" do
      site.set_setting!("tagline", "The best site")
      get "/api/v1/site"
      expect(response).to have_http_status(:ok)
      data = response.parsed_body["data"]
      expect(data["type"]).to eq("site")
      expect(data["attributes"]["name"]).to eq("Acme")
      expect(data["attributes"]["tagline"]).to eq("The best site")
    end
  end

  describe "GET /api/v1/posts" do
    it "returns only published posts by default" do
      get "/api/v1/posts"
      expect(response).to have_http_status(:ok)
      slugs = response.parsed_body["data"].map { |p| p["attributes"]["slug"] }
      expect(slugs).to include("hello-world")
      expect(slugs).not_to include("secret-draft")
      expect(response.parsed_body["meta"]["total"]).to eq(1)
    end

    it "returns drafts when a valid bearer token is supplied" do
      token = site.api_tokens.create!(name: "Frontend")
      get "/api/v1/posts", headers: { "Authorization" => "Bearer #{token.token}" }
      slugs = response.parsed_body["data"].map { |p| p["attributes"]["slug"] }
      expect(slugs).to include("secret-draft")
    end

    it "ignores an invalid bearer token" do
      get "/api/v1/posts", headers: { "Authorization" => "Bearer nope" }
      slugs = response.parsed_body["data"].map { |p| p["attributes"]["slug"] }
      expect(slugs).not_to include("secret-draft")
    end
  end

  describe "GET /api/v1/posts/:slug" do
    it "renders a single published post with content" do
      get "/api/v1/posts/hello-world"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"]["attributes"]["title"]).to eq("Hello World")
    end

    it "returns 404 for an unknown post" do
      get "/api/v1/posts/missing"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/pages" do
    it "lists published pages" do
      site.pages.create!(title: "About", slug: "about", status: "published", author: user)
      get "/api/v1/pages"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"].first["attributes"]["slug"]).to eq("about")
    end
  end

  describe "GET /api/v1/taxonomies" do
    it "lists terms" do
      get "/api/v1/taxonomies"
      expect(response.parsed_body["data"].first["attributes"]["name"]).to eq("News")
    end
  end

  describe "GET /api/v1/menus" do
    it "lists menus" do
      get "/api/v1/menus"
      expect(response.parsed_body["data"].first["attributes"]["location"]).to eq("header")
    end
  end

  describe "CORS" do
    it "adds Access-Control-Allow-Origin to API responses" do
      get "/api/v1/site"
      expect(response.headers["Access-Control-Allow-Origin"]).to eq("*")
    end
  end
end
