module Devise
  # Sign-in form in the AuthShell. Mirrors the standard Devise sessions/new view using
  # NitroKit::FormBuilder.
  class SignInPage < ApplicationComponent
    def initialize(resource:, resource_name:, devise_mapping:, submit_url:, forgot_url:)
      @resource = resource
      @resource_name = resource_name
      @devise_mapping = devise_mapping
      @submit_url = submit_url
      @forgot_url = forgot_url
    end

    def view_template
      render Devise::AuthLayout.new(title: "Sign in to your dashboard") do
        render NitroKit::Card.new do |card|
          card.body do
            render_error_messages
            form_for(@resource, as: @resource_name, url: @submit_url, builder: NitroKit::FormBuilder) do |form|
              form.group do
                form.field(:email, as: :email, control_html: { autofocus: true }, autocomplete: "email", label: "Email")
                form.field(:password, as: :password, autocomplete: "current-password", label: "Password")
                if @devise_mapping.rememberable?
                  render NitroKit::Checkbox.new(
                    label: "Remember me",
                    name: "#{@resource_name}[remember_me]",
                    value: "1",
                    unchecked_value: "0"
                  )
                end
                form.submit("Sign in")
              end
            end
          end
        end
        div(class: "text-center mt-4") do
          a(href: @forgot_url, class: "text-sm text-muted-foreground hover:text-foreground") { "Forgot your password?" }
        end
      end
    end

    private

    def render_error_messages
      return if @resource.errors.empty?
      div(class: "mb-4") do
        render NitroKit::Alert.new(variant: :error, title: "Unable to sign in") do
          @resource.errors.full_messages.each { |msg| p { msg } }
        end
      end
    end
  end
end
