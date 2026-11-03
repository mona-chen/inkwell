class ThemeSitesController < ApplicationController
  # All actions are read-only GET/HEAD endpoints, including public script assets.
  skip_forgery_protection

  def show
    slug = current_user&.admin? && params[:preview_theme].presence || Current.site.active_theme
    ThemeManager.activate_for_request!(self, slug)
    runtime = ThemePackages::Runtime.for(slug)
    path = "/#{params[:imported_path]}"

    # Route precedence: native published pages first, then the active theme's
    # explicit routes, then its SPA fallback, then 404. Admin/auth/API/Builder
    # and plugin routes are matched by Rails before this catch-all action.
    unless params[:preview_theme].present? && current_user&.admin?
      if (page = Current.site.pages.published.find_by(public_path: path))
        return render_public_page(page)
      end
    end

    return if runtime&.render(self, path)

    render_not_found
  end

  def asset
    runtime = ThemePackages::Runtime.for(params[:theme_slug])
    head :not_found unless runtime&.serve_asset(self, params[:asset_path])
  end

  include RendersPublicPage
end
