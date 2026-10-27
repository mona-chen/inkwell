module Admin
  class ThemesController < BaseController
    def index
      @themes = Theme.discover
      @active_theme = Current.site.active_theme
      render Admin::ThemesPage.new(themes: @themes, active_theme: @active_theme)
    end

    # Theme packages contain server-side templates; importing is a platform-admin action.
    def import
      return head :forbidden unless current_user.admin?
      upload = params[:archive]
      raise ThemePackages::Invalid, "Choose a ZIP archive" unless upload.respond_to?(:tempfile)
      raise ThemePackages::Invalid, "Archive exceeds 200 MB" if upload.size > ThemePackages::Importer::MAX_BYTES
      slug = params[:slug].presence || File.basename(upload.original_filename, ".zip").parameterize
      manifest = ThemePackages::Importer.new.import_zip!(upload.tempfile.path, slug: slug, spa: ActiveModel::Type::Boolean.new.cast(params[:spa]))
      redirect_to admin_themes_path, notice: "Imported #{manifest.fetch('name')}. Review dependencies and preview before activating."
    rescue ThemePackages::Invalid, Errno::ENOENT => error
      redirect_to admin_themes_path, alert: error.message
    end

    def activate
      return head :not_found unless ThemeManager.available.include?(params[:id])
      if (runtime = ThemePackages::Runtime.for(params[:id]))
        errors = runtime.readiness_errors
        return redirect_to admin_themes_path, alert: errors.join(". ") if errors.any?
      end
      Current.site.update!(active_theme: params[:id])
      redirect_to admin_themes_path, notice: "Theme activated."
    end

    # Renders the live site in an iframe with ?preview_theme=<slug> so admins can preview
    # a theme without switching the live site (SiteController honors this param for admins).
    def preview
      return head :not_found unless ThemeManager.available.include?(params[:id])
      if (runtime = ThemePackages::Runtime.for(params[:id])) && runtime.readiness_errors.any?
        return redirect_to admin_themes_path, alert: runtime.readiness_errors.join(". ")
      end
      @slug = params[:id]
      render Admin::ThemePreviewPage.new(slug: @slug)
    end
  end
end
