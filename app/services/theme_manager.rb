# Swaps the active theme's view directory to the front of Rails' view resolver chain for the
# current request. Because a theme is just `app/themes/<slug>/{layouts,posts,pages,partials}`,
# Rails' normal `render "posts/show"` lookup finds the theme's template first and silently
# falls back to `app/views/posts/show` (core default) if the theme doesn't define one —
# exactly WordPress's template-hierarchy fallback, using a mechanism Rails already has.
class ThemeManager
  class << self
    def activate_for_request!(controller, theme_slug, preview: false)
      theme_path = Rails.root.join("app/themes", theme_slug)
      return unless Dir.exist?(theme_path)

      resolver = ActionView::FileSystemResolver.new(theme_path.to_s)
      controller.prepend_view_path(resolver)
      controller.instance_variable_set(:@current_theme, theme_slug)
      controller.instance_variable_set(:@theme_preview, preview)
    end

    def manifest(theme_slug)
      manifest_path = Rails.root.join("app/themes", theme_slug, "theme.json")
      JSON.parse(File.read(manifest_path))
    rescue Errno::ENOENT, JSON::ParserError
      { "name" => theme_slug.titleize, "description" => "", "templates" => {} }
    end

    def available
      Dir.glob(Rails.root.join("app/themes/*")).map { |p| File.basename(p) }
    end
  end
end
