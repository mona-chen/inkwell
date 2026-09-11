# Public documentation and API reference. Rendered outside the admin shell and the active
# theme so the docs are always available (and shareable) regardless of the current site.
class DocsController < ApplicationController
  layout false

  def index
    render Docs::IndexPage.new
  end

  # Scalar API reference, fed by the OpenAPI spec below.
  def api
    render Docs::ApiPage.new(openapi_url: docs_openapi_path)
  end

  def openapi
    render json: Docs::Openapi.spec
  end
end
