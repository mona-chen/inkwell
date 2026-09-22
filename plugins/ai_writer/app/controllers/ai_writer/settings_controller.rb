module AiWriter
  # Plugin settings: base URL, model, and API key for any OpenAI-compatible endpoint, an
  # optional image model that switches on picture generation, optional MCP design-research
  # tools (DesignMD), and the Copilot's web tools (read a page, search the web). Stored as site
  # settings; keys fall back to ENV vars at call time and never reach the browser.
  #
  # The two check actions exist because a configured-but-broken integration used to be
  # invisible: the tool simply went quiet. "Check connection" answers the question the operator
  # is actually asking — is this thing working right now, and if not, why.
  class SettingsController < Admin::BaseController
    SETTING_KEYS = %w[
      ai_base_url ai_model ai_api_key
      ai_image_base_url ai_image_model ai_image_api_key
      mcp_enabled mcp_url mcp_token
      web_fetch_enabled web_search_provider web_search_base_url web_search_api_key
    ].freeze

    # Probe timeouts are deliberately short: this runs inside a settings request, and a server
    # that needs longer than this to answer is down as far as the operator is concerned.
    CHECK_TIMEOUTS = { open_timeout: 6, read_timeout: 8 }.freeze

    def show
      render AiWriter::SettingsPage.new(site: Current.site)
    end

    def update
      SETTING_KEYS.each do |key|
        next unless params.dig(:ai_writer, key)

        Current.site.set_setting!(key, params[:ai_writer][key])
      end
      redirect_to settings_url, notice: "Copilot settings saved."
    end

    def web_check
      result = WebClient.new(site: Current.site).check
      flash_result("Web search", result)
    end

    def mcp_check
      client = McpClient.new(url: Current.site.setting("mcp_url").presence || McpClient::DEFAULT_URL,
                             token: Current.site.setting("mcp_token").to_s, **CHECK_TIMEOUTS)
      flash_result("Design research", client.check)
    end

    private

    def flash_result(label, result)
      if result[:ok]
        redirect_to settings_url, notice: "#{label}: #{result[:message]}"
      else
        redirect_to settings_url, alert: "#{label}: #{result[:message]}"
      end
    end

    def settings_url
      AiWriter::Engine.routes.url_helpers.settings_path
    end
  end
end
