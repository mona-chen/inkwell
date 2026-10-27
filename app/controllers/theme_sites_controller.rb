class ThemeSitesController < ApplicationController
  # All actions are read-only GET/HEAD endpoints, including public script assets.
  skip_forgery_protection
  def show
    slug = current_user&.admin? && params[:preview_theme].presence || Current.site.active_theme
    ThemeManager.activate_for_request!(self, slug)
    runtime = ThemePackages::Runtime.for(slug)
    path = "/#{params[:imported_path]}"
    return if runtime&.render(self, path, fallback: false)

    if (page = Current.site.pages.published.find_by(public_path: path))
      render_public_page(page)
    elsif !runtime&.render(self, path)
      render_not_found
    end
  end

  def asset
    runtime = ThemePackages::Runtime.for(params[:theme_slug])
    head :not_found unless runtime&.serve_asset(self, params[:asset_path])
  end

  include RendersPublicPage
end
