# frozen_string_literal: true

module AiWriter
  # Plugin settings page (admin shell via Admin::BaseController's "admin" layout).
  class SettingsPage < ApplicationComponent
    def initialize(site:)
      @site = site
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render Admin::ToolbarTitle.new(title: "Copilot", subtitle: "Connect any OpenAI-compatible API for the block editor's AI assistant")
        end
      end

      render SettingsSection.new(
        title: "API connection",
        description: "Base URL, model, and key for the block editor's AI assistant."
      ) do |section|
        section.form do
          form_with(url: AiWriter::Engine.routes.url_helpers.settings_path, method: :post, scope: "ai_writer", builder: NitroKit::FormBuilder) do |form|
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
            form.group do
              form.submit("Save settings")
            end
          end
        end
      end
    end

    private

    def setting_value(key, default = nil)
      @site.setting(key, default)
    end
  end
end
