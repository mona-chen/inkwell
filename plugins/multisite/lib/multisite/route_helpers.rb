module Multisite
  # Shared access to this engine's URL helpers for controllers, components, and mailers:
  #   multisite_routes.admin_sites_path   #=> "/plugins/multisite/admin/sites"
  module RouteHelpers
    def multisite_routes
      Multisite::Engine.routes.url_helpers
    end
  end
end
