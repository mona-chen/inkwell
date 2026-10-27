# Bundlers commonly emit absolute /assets/... imports. Resolve those through the
# current site's theme after site resolution, while host Rails assets win collisions.
class ThemePublicAssets
  def initialize(app)
    @app = app
  end

  def call(env)
    if %w[GET HEAD].include?(env["REQUEST_METHOD"]) && env["PATH_INFO"].to_s.start_with?("/assets/")
      asset_name = env["PATH_INFO"].delete_prefix("/assets/")
      unless Rails.application.assets.load_path.find(asset_name)
        slug = Current.site&.active_theme
        # A namespaced module/stylesheet can request absolute child chunks during
        # preview. Its public namespace identifies the same theme without changing
        # the active site or storing a browser-wide preview session.
        begin
          referer = URI.parse(env["HTTP_REFERER"].to_s)
          request = Rack::Request.new(env)
          if referer.host == request.host && (match = referer.path.match(%r{\A/theme-assets/([a-z][a-z0-9_-]{0,63})/}))
            slug = match[1]
          end
        rescue URI::InvalidURIError
          # An absent/invalid referrer simply uses the active site's theme.
        end
        runtime = ThemePackages::Runtime.for(slug)
        file = runtime&.asset_file("assets/#{asset_name}")
        if file
          return Rack::Files.new(file.dirname.to_s).call(env.merge("PATH_INFO" => "/#{file.basename}"))
        end
      end
    end
    @app.call(env)
  end
end
