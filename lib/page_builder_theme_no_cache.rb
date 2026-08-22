# The Ink Builder fetches its canvas theme templates/widgets from /page_builder_theme each time
# the builder loads. They are static public files with no cache headers, so browsers can
# heuristically cache them and keep serving stale templates after we restyle the canvas. Force
# no-store for that path so template/CSS changes always reach the builder.
class PageBuilderThemeNoCache
  def initialize(app)
    @app = app
  end

  def call(env)
    status, headers, body = @app.call(env)
    if env["PATH_INFO"].to_s.start_with?("/page_builder_theme")
      Rails.logger.info("[PageBuilderThemeNoCache] #{env['PATH_INFO']} -> #{status}")
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
      headers["Pragma"] = "no-cache"
    end
    [ status, headers, body ]
  end
end
