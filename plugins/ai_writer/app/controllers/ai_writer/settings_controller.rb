module AiWriter
  # Plugin settings: base URL, model, and API key for any OpenAI-compatible endpoint.
  # Stored as site settings; the key falls back to the OPENAI_API_KEY env var at call time.
  class SettingsController < Admin::BaseController
    SETTING_KEYS = %w[ai_base_url ai_model ai_api_key].freeze

    def show
      render AiWriter::SettingsPage.new(site: Current.site)
    end

    def update
      SETTING_KEYS.each do |key|
        next unless params.dig(:ai_writer, key)

        Current.site.set_setting!(key, params[:ai_writer][key])
      end
      redirect_to settings_url, notice: "AI Writer settings saved."
    end

    private

    def settings_url
      AiWriter::Engine.routes.url_helpers.settings_path
    end
  end
end
