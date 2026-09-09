module Devise
  # Full HTML document for auth pages, rendered by the app's custom Devise controllers.
  class AuthLayout < ApplicationComponent
    def initialize(title:)
      @title = title
    end

    def view_template
      html lang: "en" do
        head do
          meta charset: "utf-8"
          meta name: "viewport", content: "width=device-width,initial-scale=1"
          title { "#{@title} — Inkwell" }
          csrf_meta_tags
          csp_meta_tag
          stylesheet_link_tag "ink", "data-turbo-track": "reload"
          stylesheet_link_tag "tailwind", "data-turbo-track": "reload"
          stylesheet_link_tag "application", "data-turbo-track": "reload"
          javascript_importmap_tags
        end
        body do
          div(class: "min-h-svh grid place-items-center bg-background p-6", data: { ink: "auth-shell" }) do
            div(class: "w-full max-w-sm bg-card border border-border p-8 shadow-lg") do
              div(class: "flex items-center gap-2 mb-5") do
                span(class: "flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground text-sm font-bold") { "I" }
                strong(class: "text-sm font-semibold tracking-tight") { "Inkwell" }
              end
              h1(class: "text-lg font-semibold tracking-tight") { @title }
              div(class: "mt-6") { yield }
            end
          end
        end
      end
    end
  end
end
