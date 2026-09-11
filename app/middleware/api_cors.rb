# Lightweight CORS for the read-only JSON API, so browser-based frontends on another origin
# can consume a site's content. No dependency on rack-cors.
#
# Allowed origins:
#   * ENV["INKWELL_API_ORIGINS"] unset → "*" (public read API, safe for GET)
#   * comma-separated list → only those origins are echoed back
class ApiCors
  ALLOWED_METHODS = "GET, OPTIONS".freeze
  ALLOWED_HEADERS = "Authorization, Content-Type".freeze

  def initialize(app)
    @app = app
  end

  def call(env)
    request = ActionDispatch::Request.new(env)
    return @app.call(env) unless request.path.start_with?("/api/")

    origin = request.headers["Origin"]
    headers = cors_headers(origin)

    if request.options?
      [ 204, headers, [] ]
    else
      status, response_headers, body = @app.call(env)
      [ status, response_headers.merge(headers), body ]
    end
  end

  private

  def cors_headers(origin)
    allowed = allowed_origin(origin)
    headers = {
      "Access-Control-Allow-Methods" => ALLOWED_METHODS,
      "Access-Control-Allow-Headers" => ALLOWED_HEADERS
    }
    if allowed
      headers["Access-Control-Allow-Origin"] = allowed
      headers["Vary"] = "Origin" unless allowed == "*"
    end
    headers
  end

  def allowed_origin(origin)
    configured = ENV["INKWELL_API_ORIGINS"].to_s.split(",").map(&:strip).reject(&:empty?)
    return "*" if configured.empty?
    return origin if origin.present? && configured.include?(origin)

    nil
  end
end
