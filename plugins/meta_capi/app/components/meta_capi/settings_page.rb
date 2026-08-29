# frozen_string_literal: true

module MetaCapi
  # Settings page for the Meta Conversions API plugin.
  # Account owners configure their Pixel ID, Access Token, and optional Test Event Code here.
  class SettingsPage < ApplicationComponent
    def initialize(site:)
      @site = site
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render Admin::ToolbarTitle.new(
            title: "Meta Conversions API",
            subtitle: "Send server-side events to Meta for better ad measurement and targeting"
          )
        end
      end

      render NitroKit::SettingsSection.new(
        title: "Connection",
        description: "Connect your Meta Pixel to send server-side events via the Conversions API. Events are sent from the server, bypassing ad blockers and browser limitations."
      ) do |section|
        section.form do
          form_with(
            url: MetaCapi::Engine.routes.url_helpers.settings_path,
            method: :post,
            scope: "meta_capi",
            builder: NitroKit::FormBuilder
          ) do |form|
            form.group do
              form.field(
                :meta_pixel_id,
                value: setting_value("meta_pixel_id"),
                label: "Pixel ID",
                placeholder: "e.g. 123456789012345",
                help: "Your Meta Pixel ID (found in Meta Events Manager → Pixel → Settings)"
              )
              form.field(
                :meta_access_token,
                value: setting_value("meta_access_token"),
                label: "Access Token",
                as: :password,
                placeholder: "EAAD...",
                help: "A Conversions API access token from Meta Events Manager. Generate one under Settings → Conversions API → Create Access Token."
              )
              form.field(
                :meta_test_event_code,
                value: setting_value("meta_test_event_code"),
                label: "Test Event Code (optional)",
                placeholder: "TEST12345",
                help: "If set, events are sent in test mode and won't affect your live analytics. Generate a test code in Meta Events Manager → Test Events."
              )
            end

            div(class: "px-1 pb-2 text-xs leading-relaxed text-muted-foreground") do
              plain "Meta CAPI sends events server-to-server, so they are not affected by ad blockers or browser privacy features. "
              plain "The Pixel ID and Access Token are stored in site settings and never sent to the browser."
            end

            form.group do
              form.submit("Save settings")
            end
          end
        end
      end

      render NitroKit::SettingsSection.new(
        title: "Events",
        description: "The plugin automatically sends the following events when the corresponding actions occur on your site."
      ) do |section|
        section.form do
          div(class: "space-y-3 px-1") do
            event_row("ViewContent", "Sent when a post is published", "post_published hook")
            event_row("Lead", "Sent when a contact form submission is received", "contact_form_submitted hook")
            event_row("Lead", "Sent when a new newsletter subscriber signs up", "newsletter_subscribed hook")
          end
        end
      end
    end

    private

    def setting_value(key, default = nil)
      @site.setting(key, default)
    end

    def event_row(event_name, description, source)
      div(class: "flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3") do
        div(class: "mt-0.5") do
          render NitroKit::Badge.new(event_name, variant: :outline, size: :xs)
        end
        div(class: "flex-1 min-w-0") do
          p(class: "text-sm text-foreground") { description }
          p(class: "text-xs text-muted-foreground mt-0.5") { "Trigger: #{source}" }
        end
      end
    end
  end
end
