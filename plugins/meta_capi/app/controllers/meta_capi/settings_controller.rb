# frozen_string_literal: true

module MetaCapi
  # Plugin settings: Pixel ID, Access Token, and optional Test Event Code for Meta's
  # Conversions API. Stored as site-level options via the existing options system.
  class SettingsController < Admin::BaseController
    SETTING_KEYS = %w[
      meta_pixel_id
      meta_access_token
      meta_test_event_code
    ].freeze

    def show
      render MetaCapi::SettingsPage.new(site: Current.site)
    end

    def update
      SETTING_KEYS.each do |key|
        next unless params.dig(:meta_capi, key)

        Current.site.set_setting!(key, params[:meta_capi][key])
      end
      redirect_to settings_url, notice: "Meta CAPI settings saved."
    end

    private

    def settings_url
      MetaCapi::Engine.routes.url_helpers.settings_path
    end
  end
end
