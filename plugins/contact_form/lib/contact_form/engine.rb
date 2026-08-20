module ContactForm
  class Engine < ::Rails::Engine
    include Inkwell::Plugin
    isolate_namespace ContactForm

    plugin_name "Contact Form"
    plugin_description "Adds a [contact-form] block type and stores submissions for review."
    plugin_version "1.0.0"

    register_admin_nav(label: "Contact Messages", path: "/plugins/contact_form/messages", icon: "envelope")

    def on_activate
      # Registers a brand-new block type — this is the extension point that lets a plugin
      # add editor/renderer capability without core ever knowing "contact form" exists.
      BlockRenderer.register("contact_form", ContactForm::FormBlockComponent)

      Inkwell::Hooks.on_action(:contact_form_submitted, source: plugin_slug) do |message|
        ContactForm::NotifyAdminJob.perform_later(message.id)
      end
    end

    def on_deactivate
      Inkwell::Hooks.remove_source!(plugin_slug)
    end
  end
end
