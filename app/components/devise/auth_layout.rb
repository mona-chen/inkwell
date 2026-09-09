module Devise
  # Full HTML document for auth pages, rendered by the app's custom Devise controllers.
  class AuthLayout < ApplicationComponent
    def initialize(title:, subtitle: nil)
      @title = title
      @subtitle = subtitle
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
          render Ink::Flash.new(flash) if respond_to?(:flash)
          render Ink::AuthShell.new(title: @title, subtitle: @subtitle) { yield }
        end
      end
    end
  end
end
