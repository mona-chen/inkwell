module PublicThemeHelper
  # Keep local navigation within an authenticated preview without touching external links.
  def public_theme_navigation_url(url)
    return url unless @theme_preview && url.to_s.start_with?("/") && !url.to_s.start_with?("//")
    uri = URI.parse(url)
    query = Rack::Utils.parse_nested_query(uri.query.to_s).merge("preview_theme" => @current_theme)
    query["theme_home"] = "1" if uri.path == "/"
    query["theme_defaults"] = "1" if params[:theme_defaults] == "1" || params[:theme_home] == "1"
    uri.query = query.to_query
    uri.to_s
  rescue URI::InvalidURIError
    url
  end
end
