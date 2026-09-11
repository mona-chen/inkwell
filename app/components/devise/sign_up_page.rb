module Devise
  # "Create your account" — public self-service registration scoped to the current site.
  # Mirrors the sign-in page's structure and uses Ink::FormBuilder.
  class SignUpPage < ApplicationComponent
    def initialize(resource:, resource_name:, submit_url:, sign_in_url:)
      @resource = resource
      @resource_name = resource_name
      @submit_url = submit_url
      @sign_in_url = sign_in_url
    end

    def view_template
      render Devise::AuthLayout.new(
        title: "Create your account",
        subtitle: "Join #{site_name} — it only takes a moment."
      ) do
        render_error_messages
        form_for(@resource, as: @resource_name, url: @submit_url, builder: Ink::FormBuilder) do |form|
          form.group do
            form.field(:name, control_html: { autofocus: true }, autocomplete: "name", label: "Name")
            form.field(:email, as: :email, autocomplete: "email", label: "Email")
            form.field(
              :password,
              as: :password,
              autocomplete: "new-password",
              label: "Password",
              description: "Use at least #{minimum_password_length} characters."
            )
          end
          form.submit("Create account")
        end

        div(class: "mt-6 border-t border-border pt-4 text-center") do
          p(class: "text-sm text-muted-foreground") do
            plain "Already have an account? "
            a(href: @sign_in_url, class: "font-medium text-foreground hover:text-primary transition-colors") { "Sign in" }
          end
        end
      end
    end

    private

    def site_name
      (Current.site || Site.find_by(is_default: true) || Site.first)&.name || "Inkwell"
    end

    def minimum_password_length
      Devise.password_length.min
    end

    def render_error_messages
      return if @resource.errors.empty?

      div(class: "mb-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3") do
        p(class: "text-sm font-semibold text-destructive") { "We couldn't create your account" }
        ul(class: "mt-1.5 space-y-0.5 list-disc pl-4 text-sm text-destructive") do
          @resource.errors.full_messages.each { |msg| li { msg } }
        end
      end
    end
  end
end
