module Devise
  # "Forgot your password?" — request a reset link. Mirrors devise/passwords/new.
  class PasswordRequestPage < ApplicationComponent
    def initialize(resource:, resource_name:, submit_url:, back_url:)
      @resource = resource
      @resource_name = resource_name
      @submit_url = submit_url
      @back_url = back_url
    end

    def view_template
      render Devise::AuthLayout.new(title: "Reset your password") do
        render NitroKit::Card.new do |card|
          card.body do
            render_error_messages
            form_for(@resource, as: @resource_name, url: @submit_url, html: { method: :post }, builder: NitroKit::FormBuilder) do |form|
              form.group do
                form.field(:email, as: :email, control_html: { autofocus: true }, autocomplete: "email", label: "Email")
                form.submit("Send reset instructions")
              end
            end
          end
        end
        div(class: "text-center mt-4") do
          a(href: @back_url, class: "text-sm text-muted-foreground hover:text-foreground") { "Back to sign in" }
        end
      end
    end

    private

    def render_error_messages
      return if @resource.errors.empty?
      div(class: "mb-4") do
        render NitroKit::Alert.new(variant: :error, title: "Unable to send reset instructions") do
          @resource.errors.full_messages.each { |msg| p { msg } }
        end
      end
    end
  end
end
