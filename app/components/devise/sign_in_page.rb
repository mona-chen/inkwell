module Devise
  # Sign-in form in the AuthShell. Mirrors the standard Devise sessions/new view using
  # Ink::FormBuilder.
  class SignInPage < ApplicationComponent
    def initialize(resource:, resource_name:, devise_mapping:, submit_url:, forgot_url:, sign_up_url: nil, registration_open: false)
      @resource = resource
      @resource_name = resource_name
      @devise_mapping = devise_mapping
      @submit_url = submit_url
      @forgot_url = forgot_url
      @sign_up_url = sign_up_url
      @registration_open = registration_open
    end

    def view_template
      render Devise::AuthLayout.new(title: "Welcome back", subtitle: "Sign in to write, design, and publish with Inkwell.") do
        render_error_messages
        form_for(@resource, as: @resource_name, url: @submit_url, builder: Ink::FormBuilder) do |form|
          form.group do
            form.field(:email, as: :email, control_html: { autofocus: true }, autocomplete: "email", label: "Email")
            form.field(:password, as: :password, autocomplete: "current-password", label: "Password")
            if @devise_mapping.rememberable?
              render Ink::Checkbox.new(
                label: "Remember me",
                name: "#{@resource_name}[remember_me]",
                value: "1",
                unchecked_value: "0"
              )
            end
            form.submit("Sign in")
          end
        end

        div(class: "mt-4 text-center") do
          a(href: @forgot_url, class: "text-sm text-muted-foreground hover:text-foreground transition-colors") { "Forgot your password?" }
        end

        if @registration_open && @sign_up_url
          div(class: "mt-6 border-t border-border pt-4 text-center") do
            p(class: "text-sm text-muted-foreground") do
              plain "New here? "
              a(href: @sign_up_url, class: "font-medium text-foreground hover:text-primary transition-colors") { "Create an account" }
            end
          end
        end
      end
    end

    private

    def render_error_messages
      return if @resource.errors.empty?

      div(class: "mb-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3") do
        p(class: "text-sm font-semibold text-destructive") { "Unable to sign in" }
        ul(class: "mt-1.5 space-y-0.5 list-disc pl-4 text-sm text-destructive") do
          @resource.errors.full_messages.each { |msg| li { msg } }
        end
      end
    end
  end
end
