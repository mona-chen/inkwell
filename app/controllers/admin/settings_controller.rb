module Admin
  class SettingsController < BaseController
    SETTINGS_SCHEMA = %w[
      site_title tagline site_url timezone posts_per_page comments_enabled
      show_on_front page_on_front
    ].freeze

    def show
      @site = Current.site
      render Admin::SettingsPage.new(site: @site)
    end

    def update
      SETTINGS_SCHEMA.each do |key|
        next unless params[:settings]&.key?(key)

        Current.site.set_setting!(key, params[:settings][key])
      end
      # Filter lets plugins persist their own settings alongside core ones from the same form,
      # e.g. the SEO plugin adds a "default meta description" field via this hook.
      Inkwell::Hooks.fire(:settings_updated, params[:settings])
      redirect_to admin_settings_path, notice: "Settings saved."
    end
  end
end
