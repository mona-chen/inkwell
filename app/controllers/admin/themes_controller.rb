module Admin
  class ThemesController < BaseController
    def index
      @themes = Theme.discover
      @active_theme = Current.site.active_theme
      render Admin::ThemesPage.new(themes: @themes, active_theme: @active_theme)
    end

    def activate
      Current.site.update!(active_theme: params[:id])
      redirect_to admin_themes_path, notice: "Theme activated."
    end

    # Renders the live site in an iframe with ?preview_theme=<slug> so admins can preview
    # a theme without switching the live site (SiteController honors this param for admins).
    def preview
      @slug = params[:id]
      render Admin::ThemePreviewPage.new(slug: @slug)
    end
  end
end
