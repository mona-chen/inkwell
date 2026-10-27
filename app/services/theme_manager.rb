# Swaps the active theme's view directory to the front of Rails' view resolver chain for the
# current request. Because a theme is just `app/themes/<slug>/{layouts,posts,pages,partials}`,
# Rails' normal `render "posts/show"` lookup finds the theme's template first and silently
# falls back to `app/views/posts/show` (core default) if the theme doesn't define one —
# exactly WordPress's template-hierarchy fallback, using a mechanism Rails already has.
class ThemeManager
  class << self
    def activate_for_request!(controller, theme_slug, preview: false)
      return unless theme_slug.to_s.match?(/\A[a-z][a-z0-9_-]*\z/)
      theme_path = Rails.root.join("app/themes", theme_slug)
      return unless Dir.exist?(theme_path)

      package = ThemePackages::Runtime.for(theme_slug)
      if package
        fallback = ActionView::FileSystemResolver.new(Rails.root.join("app/themes/default").to_s)
        controller.prepend_view_path(fallback)
        theme_path = theme_path.join(package.manifest.data.fetch("views", "views")) if package.manifest.kind == "rails"
      end
      resolver = ActionView::FileSystemResolver.new(theme_path.to_s)
      controller.prepend_view_path(resolver)
      controller.instance_variable_set(:@current_theme, theme_slug)
      controller.instance_variable_set(:@theme_preview, preview)
    end

    def manifest(theme_slug)
      return {} unless theme_slug.to_s.match?(/\A[a-z][a-z0-9_-]*\z/)
      manifest_path = Rails.root.join("app/themes", theme_slug, "theme.json")
      JSON.parse(File.read(manifest_path))
    rescue Errno::ENOENT, JSON::ParserError
      { "name" => theme_slug.titleize, "description" => "", "templates" => {} }
    end

    def available
      Dir.glob(Rails.root.join("app/themes/*/theme.json")).map { |p| File.basename(File.dirname(p)) }
    end
  end
end
