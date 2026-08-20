module Devise
  # "Choose a new password" — mirrors devise/passwords/edit.
  class PasswordEditPage < ApplicationComponent
    def initialize(resource:, resource_name:, minimum_password_length:, submit_url:)
      @resource = resource
      @resource_name = resource_name
      @minimum_password_length = minimum_password_length
      @submit_url = submit_url
    end

    def view_template
      render Devise::AuthLayout.new(title: "Choose a new password") do
        render NitroKit::Card.new do |card|
          card.body do
            render_error_messages
            form_for(@resource, as: @resource_name, url: @submit_url, html: { method: :put }, builder: NitroKit::FormBuilder) do |form|
              form.hidden_field(:reset_password_token)
              form.group do
                form.field(
                  :password,
                  as: :password,
                  control_html: { autofocus: true },
                  autocomplete: "new-password",
                  label: "New password",
                  description: @minimum_password_length ? "#{@minimum_password_length} characters minimum" : nil
                )
                form.field(:password_confirmation, as: :password, autocomplete: "new-password", label: "Confirm new password")
                form.submit("Change my password")
              end
            end
          end
        end
      end
    end

    private

    def render_error_messages
      return if @resource.errors.empty?
      div(class: "mb-4") do
        render NitroKit::Alert.new(variant: :error, title: "Unable to change your password") do
          @resource.errors.full_messages.each { |msg| p { msg } }
        end
      end
    end
  end
end
