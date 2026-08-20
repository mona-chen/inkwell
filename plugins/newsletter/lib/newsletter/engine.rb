module Newsletter
  class Engine < ::Rails::Engine
    include Inkwell::Plugin
    isolate_namespace Newsletter

    plugin_name "Newsletter"
    plugin_description "Collects subscriber emails and fires a hook other plugins can act on."
    plugin_version "1.0.0"

    register_admin_nav(label: "Subscribers", path: "/plugins/newsletter/subscribers", icon: "at-symbol")

    def on_activate
      # Deliberately does NOT send emails itself — it fires an action and leaves delivery to
      # whatever's configured (an ESP-integration plugin, a mailer, etc). This is the
      # "small, composable plugins" pattern WordPress plugins rarely achieve because global
      # hooks make every plugin tempted to also own delivery, storage, and UI all at once.
      Inkwell::Hooks.on_action(:post_published, source: plugin_slug) do |post|
        Newsletter::NotifySubscribersJob.perform_later(post.id)
      end
    end

    def on_deactivate
      Inkwell::Hooks.remove_source!(plugin_slug)
    end
  end
end
