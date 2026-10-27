class PagesController < ApplicationController
  before_action :activate_theme

  include RendersPublicPage

  def show
    page = if params[:imported_path]
      Current.site.pages.where(template_for: nil).published.find_by!(public_path: "/#{params[:imported_path]}")
    else
      Current.site.pages.where(template_for: nil).published.friendly.find(params[:id])
    end
    render_public_page(page)
  end

  private

  def activate_theme
    preview_theme = params[:preview_theme] if current_user&.admin?
    ThemeManager.activate_for_request!(self, preview_theme || Current.site.active_theme, preview: preview_theme.present?)
  end
end
