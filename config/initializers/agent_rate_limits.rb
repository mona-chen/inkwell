require Rails.root.join("lib/inkwell/mcp/request_guard")
Rails.application.config.middleware.insert_before(0, Inkwell::Mcp::RequestGuard)
# Rate limits contain no bearer secrets: the token discriminator is a digest.
Rails.application.config.middleware.use Rack::Attack
Rack::Attack.throttle("mcp/ip", limit: 300, period: 60) do |request|
  request.ip if request.path == "/mcp"
end
Rack::Attack.throttle("mcp/credential", limit: 180, period: 60) do |request|
  header = request.get_header("HTTP_AUTHORIZATION").to_s
  Digest::SHA256.hexdigest(header) if request.path == "/mcp" && header.present?
end
