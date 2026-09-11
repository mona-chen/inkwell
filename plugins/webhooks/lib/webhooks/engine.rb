module Webhooks
  class Engine < ::Rails::Engine
    include Inkwell::Plugin
    isolate_namespace Webhooks

    plugin_name "Webhooks"
    plugin_description "Send signed HTTP webhooks to external services when content changes."
    plugin_version "1.0.0"

    register_admin_nav(label: "Webhooks", path: "/plugins/webhooks/settings", icon: "webhook", section: "Extensions")

    # Domain events this plugin fans out. Kept in sync with Webhooks::Endpoint::EVENT_NAMES.
    EVENTS = %i[
      post_published
      post_updated
      page_published
      comment_moderated
      contact_form_submitted
      newsletter_subscribed
    ].freeze

    def on_activate
      EVENTS.each do |event|
        Inkwell::Hooks.on_action(event, source: plugin_slug) do |record|
          Webhooks::Dispatcher.dispatch(event, record)
        end
      end
    end

    def on_deactivate
      Inkwell::Hooks.remove_source!(plugin_slug)
    end
  end
end
