require "rails_helper"

RSpec.describe "Documentation and API reference", type: :request do
  describe "GET /docs" do
    it "renders the documentation page" do
      get "/docs"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Inkwell documentation")
      expect(response.body).to include("Building plugins")
      expect(response.body).to include("Dynamic content")
      expect(response.body).to include("Multisite")
    end
  end

  describe "GET /docs/api" do
    it "renders the Scalar API reference shell" do
      get "/docs/api"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include('id="api-reference"')
      expect(response.body).to include("/docs/openapi.json")
      expect(response.body).to include("@scalar/api-reference")
    end
  end

  describe "GET /docs/openapi.json" do
    it "serves the OpenAPI spec" do
      get "/docs/openapi.json"
      expect(response).to have_http_status(:ok)
      spec = response.parsed_body
      expect(spec["openapi"]).to eq("3.1.0")
      expect(spec["paths"].keys).to include("/posts", "/pages", "/site")
      expect(spec.dig("components", "securitySchemes", "bearerAuth", "scheme")).to eq("bearer")
    end
  end
end
