module ThemeAssetsHelper
  # Themes share Inkwell's Hotwire packages but own their entrypoint/controllers.
  # Build one combined import map; never start the admin application in a theme.
  def theme_javascript_tags(entrypoint = nil)
    manifest = ThemePackages::Manifest.new(ThemeManager.manifest(@current_theme || Current.site.active_theme))
    entrypoint ||= manifest.data.fetch("entrypoint")
    raise ArgumentError, "Unknown theme entrypoint" unless manifest.data.fetch("imports", {}).key?(entrypoint)
    map = JSON.parse(Rails.application.importmap.to_json(resolver: self))
    manifest.data.fetch("imports", {}).each { |name, path| map["imports"][name] = theme_asset_path(path) }
    safe_join([javascript_inline_importmap_tag(ERB::Util.json_escape(map.to_json)), javascript_import_module_tag(entrypoint)], "\n")
  end

  def theme_asset_path(path)
    slug = @current_theme || Current.site.active_theme
    raise ArgumentError, "Invalid theme asset path" unless path.is_a?(String) && ThemePackages::Manifest.new(ThemeManager.manifest(slug)).safe_path?(path)
    "/theme-assets/#{slug}/#{path}"
  end
end
