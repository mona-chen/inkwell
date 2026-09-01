module Devise
  # Full HTML document for auth pages (sign in, password reset). Renders the Nitro
  # AuthShell around a content block. Rendered by the app's custom Devise controllers.
  class AuthLayout < ApplicationComponent
    def initialize(title:, &content)
      @title = title
      @content = content
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
          stylesheet_link_tag "nitro_theme", "data-turbo-track": "reload"
          stylesheet_link_tag "tailwind", "data-turbo-track": "reload"
          stylesheet_link_tag "application", "data-turbo-track": "reload"
          javascript_importmap_tags
        end
        body do
          render Ink::AuthShell.new do
            div(class: "text-center") do
              h1(class: "text-2xl font-bold tracking-tight") { "Inkwell" }
              p(class: "text-sm text-muted-foreground mt-2") { @title }
            end
            yield
          end
        end
      end
    end
  end
end
