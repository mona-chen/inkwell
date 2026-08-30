module Admin
  class SettingsController < BaseController
    SECTIONS = %w[general homepage maintenance].freeze
    SETTINGS_SCHEMA = %w[
      site_title tagline site_url timezone posts_per_page comments_enabled site_logo
      show_on_front page_on_front
    ].freeze

    def show
      @site = Current.site
      render Admin::SettingsPage.new(site: @site, section: settings_section)
    end

    def update
      SETTINGS_SCHEMA.each do |key|
        next unless params[:settings]&.key?(key)

        Current.site.set_setting!(key, params[:settings][key])
      end
      # Filter lets plugins persist their own settings alongside core ones from the same form,
      # e.g. the SEO plugin adds a "default meta description" field via this hook.
      Inkwell::Hooks.fire(:settings_updated, params[:settings])
      redirect_to admin_settings_path(section: settings_section), status: :see_other, notice: "Settings saved."
    end

    # Maintenance: clear the application cache (fragments, Solid Cache in prod). Also bumps
    # the asset digest so browsers fetch freshly-compiled stylesheets (Propshaft re-digests
    # when the file changes, but this forces a clean slate for cached render fragments).
    def purge_cache
      Rails.cache.clear
      # Touch the stylesheet so Propshaft computes a new digest on the next request.
      stylesheet_path = Rails.root.join("app/assets/builds/tailwind.css")
      if stylesheet_path.exist?
        File.utime(File.mtime(stylesheet_path), Time.now, stylesheet_path)
      end
      redirect_to admin_settings_path(section: "maintenance"), status: :see_other, notice: "Cache cleared."
    end

    private

    def settings_section
      section = params[:section].to_s
      SECTIONS.include?(section) ? section : "general"
    end
  end
end
