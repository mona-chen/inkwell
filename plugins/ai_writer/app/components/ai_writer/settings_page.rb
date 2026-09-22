# frozen_string_literal: true

module AiWriter
  # Plugin settings page (admin shell via Admin::BaseController's "admin" layout).
  class SettingsPage < ApplicationComponent
    SECONDARY_BUTTON = "inline-flex h-9 items-center justify-center rounded-lg border border-border " \
                       "bg-card px-4 text-sm font-medium text-foreground shadow-xs transition-colors " \
                       "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40".freeze

    def initialize(site:)
      @site = site
    end

    def view_template
      div(class: "max-w-[960px]") do
        render Toolbar.new do |toolbar|
          toolbar.leading do
            render Admin::ToolbarTitle.new(title: "Copilot", subtitle: "Configure the model, media, web and design-research tools used by your writing assistant")
          end
        end

        render SettingsSection.new(
          title: "API connection",
          description: "Base URL, model, and key for the block editor's AI assistant."
        ) do |section|
          section.form do
            settings_form do |form|
              form.group do
                form.field(:ai_base_url, value: setting_value("ai_base_url", Client::DEFAULT_BASE_URL), label: "API base URL")
                form.field(:ai_model, value: setting_value("ai_model", Client::DEFAULT_MODEL), label: "Model")
                form.field(:ai_api_key, value: setting_value("ai_api_key"), label: "API key", as: :password)
              end
              div(class: "px-1 pb-2 text-xs leading-relaxed text-muted-foreground") do
                "Any OpenAI-compatible endpoint works (OpenAI, Together, a local Ollama/vLLM server). " \
                "The key is stored in site settings and falls back to the OPENAI_API_KEY environment variable; " \
                "it is never sent to the browser."
              end
              save_row(form)
            end
          end
        end

        render SettingsSection.new(
          title: "Image generation",
          description: "Give the Copilot a picture generator. Name an image model to switch the tool on; every picture it makes is saved to this site's media library, so you can reuse, replace, or delete it like any other upload."
        ) do |section|
          section.form do
            settings_form do |form|
              form.group do
                form.field(:ai_image_model, value: setting_value("ai_image_model"), label: "Image model",
                           placeholder: "gpt-image-1",
                           description: "Leave blank to keep image generation off — the Copilot then writes layout with no pictures rather than inventing them.")
                form.field(:ai_image_base_url, value: setting_value("ai_image_base_url"), label: "Images API base URL",
                           placeholder: "Same as the API base URL above",
                           description: "Only needed when the image provider is not the chat endpoint (OpenAI-compatible /images/generations).")
                form.field(:ai_image_api_key, value: setting_value("ai_image_api_key"), label: "Images API key", as: :password,
                           description: "Falls back to the API key above, then to the OPENAI_API_KEY environment variable.")
              end
              div(class: "px-1 pb-2 text-xs leading-relaxed text-muted-foreground") do
                "Sizes: most providers accept 1024x1024, 1536x1024, or 1024x1536. The Copilot may only generate " \
                "images while this is configured, and each generation is billed by your provider."
              end
              save_row(form)
            end
          end
        end

        render SettingsSection.new(
          title: "Web tools",
          description: "Let the Copilot read a page and search the web while it writes — so copy, facts and competitor research come from the open web instead of the model's memory."
        ) do |section|
          section.form do
            settings_form do |form|
              form.group do
                form.field(:web_fetch_enabled, as: :switch, label: "Read web pages",
                           value: "1", checked: setting_value("web_fetch_enabled", "1") != "0")
                form.field(:web_search_provider, as: :select, label: "Search provider",
                           choices: search_provider_choices,
                           include_blank: "None — web search off",
                           value: setting_value("web_search_provider"))
                form.field(:web_search_api_key, as: :password, label: "Search API key",
                           value: setting_value("web_search_api_key"),
                           description: "Falls back to the provider's environment variable (BRAVE_SEARCH_API_KEY, TAVILY_API_KEY, SERPER_API_KEY, EXA_API_KEY).")
                form.field(:web_search_base_url, label: "Self-hosted SearXNG base URL",
                           value: setting_value("web_search_base_url"),
                           placeholder: "http://localhost:8080",
                           description: "Optional. Point at your own SearXNG (or an LLM-friendly wrapper in front of one) to search with no API key — this then takes precedence over the provider above. This URL is operator-set, so it may be a private address.")
              end
              div(class: "px-1 pb-2 text-xs leading-relaxed text-muted-foreground") do
                "Reading pages needs no key. The Copilot may only read public http(s) pages — " \
                "private and local network addresses are refused for anything the model asks for — and the " \
                "page text is used as research, never written into the design as a foreign link. " \
                "Everything on this section can also come from the environment: WEB_SEARCH_PROVIDER, " \
                "the provider's own key variable, WEB_FETCH_ENABLED=0, and SEARXNG_BASE_URL."
              end
              div(class: "flex items-center justify-between pt-2") do
                check_button("web_check", "Check search connection")
                form.submit("Save settings")
              end
            end
          end
        end

        render SettingsSection.new(
          title: "Design research (MCP)",
          description: "Let the Copilot research real design systems before it designs. Connect a Model Context Protocol server such as DesignMD (add with `claude mcp add designmd --transport http <url> --header \"Authorization: Bearer <token>\"`)."
        ) do |section|
          section.form do
            settings_form do |form|
              form.group do
                form.field(:mcp_enabled, as: :switch, label: "Enable design research tools",
                           value: "1", checked: setting_value("mcp_enabled") == "1")
                form.field(:mcp_url, value: setting_value("mcp_url", McpClient::DEFAULT_URL), label: "MCP server URL")
                form.field(:mcp_token, value: setting_value("mcp_token"), label: "Bearer token", as: :password)
              end
              div(class: "px-1 pb-2 text-xs leading-relaxed text-muted-foreground") do
                "When enabled, the Copilot can call the server's tools (search_designs, get_design, " \
                "generate_css_variables, patterns/blocks, …) to ground its designs. The token is stored " \
                "in site settings and never sent to the browser. If the server is unreachable the tools " \
                "go quiet — use Check connection to see why instead of guessing."
              end
              div(class: "flex items-center justify-between pt-2") do
                check_button("mcp_check", "Check connection")
                form.submit("Save settings")
              end
            end
          end
        end
      end
    end

    private

    def settings_form(&block)
      form_with(url: AiWriter::Engine.routes.url_helpers.settings_path, method: :post, scope: "ai_writer", builder: Ink::FormBuilder, &block)
    end

    def save_row(form)
      div(class: "flex justify-end pt-2") { form.submit("Save settings") }
    end

    # A second form beside the save button: a connection check is an action, not a setting, so it
    # posts on its own and comes back as a flash on the settings page.
    def check_button(action, label)
      form_with(url: AiWriter::Engine.routes.url_helpers.public_send("#{action}_path"), method: :post) do |form|
        form.button(label, type: "submit", class: SECONDARY_BUTTON)
      end
    end

    def search_provider_choices
      WebClient::PROVIDERS.map { |key| [ WebClient.provider_label(key), key ] }
    end

    def setting_value(key, default = nil)
      @site.setting(key, default)
    end
  end
end
