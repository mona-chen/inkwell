module Admin
  class SettingsController < BaseController
    SECTIONS = %w[general discussion homepage custom_css custom_scripts api maintenance].freeze
    # Columns on Site edited directly from the settings form.
    SITE_ATTRIBUTES = %w[name].freeze
    # Option-backed settings (Site#setting / Site#set_setting!).
    SETTINGS_SCHEMA = %w[
      tagline timezone registration_mode comments_enabled site_logo
      show_on_front page_on_front custom_css custom_scripts_head custom_scripts_body
    ].freeze

    def show
      @site = Current.site
      render Admin::SettingsPage.new(
        site: @site,
        section: settings_section,
        new_token: session.delete(:new_api_token)
      )
    end

    def update
      if params[:settings]&.key?(:custom_css)
        css = params[:settings][:custom_css]
        unless css.is_a?(String) && css.bytesize <= SiteCustomCss::MAX_BYTES
          return redirect_to admin_settings_path(section: "custom_css"), status: :see_other, alert: "Custom CSS must be text and no larger than 64 KB."
        end
      end
      %w[custom_scripts_head custom_scripts_body].each do |key|
        next unless params[:settings]&.key?(key)
        code = params[:settings][key]
        unless code.is_a?(String) && code.bytesize <= SiteCustomCss::MAX_BYTES
          return redirect_to admin_settings_path(section: "custom_scripts"), status: :see_other, alert: "Custom scripts must be text and no larger than 64 KB per field."
        end
      end
      SITE_ATTRIBUTES.each do |key|
        next unless params[:settings]&.key?(key)

        Current.site.update!(key => params[:settings][key])
      end
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
