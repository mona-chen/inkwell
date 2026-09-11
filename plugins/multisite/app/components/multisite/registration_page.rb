# frozen_string_literal: true

module Multisite
  # Public, self-serve site creation page. Mirrors the Devise AuthShell look (app-owned
  # design system, no external runtime) but for provisioning a whole new site.
  class RegistrationPage < ApplicationComponent
    def initialize(resource:, resource_name: :user, additional: false, alert: nil)
      @resource = resource
      @resource_name = resource_name
      @additional = additional
      @alert = alert
    end

    def view_template
      render Devise::AuthLayout.new(
        title: @additional ? "Create another site" : "Start your site with Inkwell",
        subtitle: @additional ? "Add a new site to your account." : "Pick a subdomain, and you're publishing in seconds."
      ) do
        render_flash
        render_error_messages if !@additional && @resource&.errors&.any?
        render_invite_to_sign_in if @additional

        form_with(url: signup_url, method: :post, class: "flex flex-col gap-3") do
          render_subdomain_field

          unless @additional
            render_field("site_name", "Site name", value: params_value(:site_name), placeholder: "My Blog", type: :text)
            render_field("name", "Your name", value: params_value(:name), placeholder: "Aaliyah Chen", type: :text, autocomplete: "name")
            render_field("email", "Email", value: params_value(:email), placeholder: "you@example.com", type: :email, autocomplete: "email")
            render_field("password", "Password", type: :password, autocomplete: "new-password")
          end

          button(
            type: "submit",
            class: "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
          ) { @additional ? "Create Site" : "Create my site" }
        end

        unless @additional
          div(class: "text-center mt-4") do
            a(href: new_user_session_path, class: "text-sm text-muted-foreground hover:text-foreground") do
              "Already have an account? Sign in"
            end
          end
        end
      end
    end

    private

    def render_subdomain_field
      div(class: "mb-3") do
        label(for: "subdomain", class: "mb-1.5 block text-xs font-medium text-foreground") { "Your subdomain" }
        div(class: "flex items-center rounded-lg border border-input bg-background shadow-xs transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 overflow-hidden") do
          input(
            type: "text",
            name: "subdomain",
            id: "subdomain",
            value: params_value(:subdomain),
            placeholder: "myblog",
            class: "h-9 w-full bg-transparent px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none",
            autofocus: true,
            required: true,
            pattern: "[a-z0-9][a-z0-9-]{1,61}[a-z0-9]",
            maxlength: 63
          )
          span(class: "shrink-0 border-l border-border bg-muted/50 px-3 text-[13px] text-muted-foreground") do
            plain ".#{base_domain}"
          end
        end
        p(class: "mt-1.5 text-xs text-muted-foreground") { "Letters, numbers, and hyphens. This becomes your site's address." }
      end
    end

    def render_field(name, label, value: nil, placeholder: nil, type: :text, autocomplete: nil)
      label(for: name, class: "mb-1.5 block text-xs font-medium text-foreground") { label }

      attrs = {
        type: type,
        name: name,
        id: name,
        class: "h-9 w-full rounded-lg border border-input bg-background px-3 text-[13px] text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none",
        required: true
      }
      attrs[:value] = value if value
      attrs[:placeholder] = placeholder if placeholder
      attrs[:autocomplete] = autocomplete if autocomplete
      input(**attrs)
    end

    def signup_url
      @additional ? new_site_path : signup_path
    end

    def params_value(key)
      value = @resource&.public_send(key) if @resource&.respond_to?(key)
      value.presence
    end

    def render_flash
      return unless @alert.present?

      div(class: "mb-4") do
        render Ink::Alert.new(variant: :error, title: @alert)
      end
    end

    def render_error_messages
      div(class: "mb-4") do
        render Ink::Alert.new(variant: :error, title: "We couldn't create your site") do
          @resource.errors.full_messages.each { |msg| p msg }
        end
      end
    end

    def render_invite_to_sign_in
      div(class: "mb-4") do
        render Ink::Alert.new(variant: :info, title: "Creating sites") do
          p { "You're signed in — this adds a new site to your existing account." }
        end
      end
    end

    def base_domain
      Site.multisite_base_domain
    end
  end
end
