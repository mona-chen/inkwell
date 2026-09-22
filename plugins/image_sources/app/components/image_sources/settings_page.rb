# frozen_string_literal: true

module ImageSources
  # Which libraries this site may pull pictures from. Everything is on by default — activating
  # the plugin is enough to give the Copilot photos, logos, avatars, mascots and screenshots —
  # so this page only ever narrows or lifts a quota.
  class SettingsPage < ApplicationComponent
    PROVIDER_NOTES = {
      "openverse" => "Openly licensed photographs from Flickr, Wikimedia, museums and more. Results carry their creator and licence, and the file keeps both.",
      "simple_icons" => "Brand and product logos (~3,500 marks, CC0). Trademark rights still belong to the brand owner.",
      "dice_bear" => "Generated avatars and mascots. The same request always produces the same character.",
      "microlink" => "A screenshot of any live URL — the “show the real product” picture. Free tier: 25 requests a day, no key needed."
    }.freeze

    def initialize(site:)
      @site = site
    end

    def view_template
      div(class: "max-w-[960px]") do
        render Toolbar.new do |toolbar|
          toolbar.leading do
            render Admin::ToolbarTitle.new(title: "Image Sources", subtitle: "Where the Copilot may look for pictures your site does not have yet")
          end
        end

        render SettingsSection.new(
          title: "Sources",
          description: "Each search files the picture into this site's media library, with its creator and licence attached."
        ) do |section|
          section.form do
            form_with(url: ImageSources::Engine.routes.url_helpers.settings_path, method: :patch, scope: "image_sources", builder: Ink::FormBuilder) do |form|
              div(class: "flex flex-col gap-2") { Settings::PROVIDER_KEYS.each { |key| provider_row(form, key) } }

              div(class: "mt-4") do
                form.field(:openverse_license,
                  as: :select,
                  label: "Openverse licences",
                  options: [ [ "Commercial use only (safest)", "commercial" ], [ "All Creative Commons, including non-commercial", "all" ] ],
                  value: Settings.openverse_license(@site))
              end

              div(class: "mt-2") do
                form.field(:microlink_api_key, value: Settings.microlink_api_key(@site), label: "Microlink API key (optional)", as: :password)
              end
              div(class: "px-1 pb-2 text-xs leading-relaxed text-muted-foreground") do
                "Keys are stored in site settings and fall back to the MICROLINK_API_KEY environment variable; they are never sent to the browser."
              end

              div(class: "flex justify-end pt-2") { form.submit("Save settings") }
            end
          end
        end

        render SettingsSection.new(
          title: "How the Copilot uses these",
          description: "One tool, whatever the source underneath."
        ) do
          div(class: "text-xs leading-relaxed text-muted-foreground") do
            plain "When at least one source is on, the Copilot gains a "
            code(class: "rounded bg-muted px-1 py-0.5") { "search_images" }
            plain " tool next to its existing "
            code(class: "rounded bg-muted px-1 py-0.5") { "list_media" }
            plain " and image generation. Switching every source off removes the tool completely, so the model is never offered something this site cannot do."
          end
          ul(class: "mt-3 flex flex-col gap-1 text-xs text-muted-foreground") do
            Registry.enabled(@site).map { |adapter| adapter.kind }.uniq.each do |kind|
              li { "· #{kind}" }
            end
          end
        end
      end
    end

    private

    def provider_row(form, key)
      enabled = Settings.provider_enabled?(@site, key)
      label(class: "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40") do
        input(
          type: "checkbox",
          id: "#{form.object_name}_provider_#{key}",
          name: "#{form.object_name}[providers][]",
          value: key,
          checked: enabled,
          class: "mt-0.5 h-4 w-4 rounded border-input accent-primary"
        )
        div do
          span(class: "block text-xs font-medium text-foreground") { Settings::PROVIDER_LABELS.fetch(key, key.titleize) }
          span(class: "mt-0.5 block text-xs leading-relaxed text-muted-foreground") { PROVIDER_NOTES[key] }
        end
      end
    end
  end
end
