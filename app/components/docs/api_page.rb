# frozen_string_literal: true

module Docs
  # Renders the Scalar API reference UI, fed by the OpenAPI spec at /docs/openapi.json.
  # Scalar is loaded from its CDN and renders the reference client-side.
  class ApiPage < ApplicationComponent
    SCALAR_CDN = "https://cdn.jsdelivr.net/npm/@scalar/api-reference".freeze
    SCALAR_CONFIG = {
      layout: "modern",
      hideClientButton: false,
      showSidebar: true,
      showDeveloperTools: false,
      showToolbar: false,
      operationTitleSource: "summary",
      persistAuth: false,
      telemetry: false,
      hideModels: false,
      documentDownloadType: "both",
      hideTestRequestButton: false,
      hideSearch: false,
      showOperationId: false,
      hideDarkModeToggle: false,
      withDefaultFonts: true,
      defaultOpenFirstTag: true,
      defaultOpenAllTags: false,
      expandAllModelSections: false,
      expandAllResponses: false,
      expandAllSchemaProperties: false,
      orderSchemaPropertiesBy: "alpha",
      orderRequiredPropertiesFirst: true,
      modelsSectionLabel: "Models"
    }.freeze

    def initialize(openapi_url:)
      @openapi_url = openapi_url
    end

    def view_template
      html lang: "en" do
        head do
          meta charset: "utf-8"
          meta name: "viewport", content: "width=device-width,initial-scale=1"
          title { "Inkwell API Reference" }
          style { raw(safe("html,body{margin:0;background:#fff}")) }
        end
        body do
          script(id: "api-reference", data: { url: @openapi_url, configuration: SCALAR_CONFIG.to_json })
          script(src: SCALAR_CDN)
        end
      end
    end
  end
end
