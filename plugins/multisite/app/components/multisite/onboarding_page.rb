# frozen_string_literal: true

module Multisite
  class OnboardingPage < ApplicationComponent
    def initialize(site:, step: "welcome")
      @site = site
      @step = step
    end

    def view_template
      html lang: "en", data: { theme: "light" } do
        head do
          meta charset: "utf-8"
          meta name: "viewport", content: "width=device-width,initial-scale=1"
          title { "Set up #{@site.name} — Inkwell" }
          csrf_meta_tags
          csp_meta_tag
          stylesheet_link_tag "ink", "data-turbo-track": "reload"
          stylesheet_link_tag "tailwind", "data-turbo-track": "reload"
          stylesheet_link_tag "application", "data-turbo-track": "reload"
          javascript_importmap_tags
        end
        body(class: "bg-background text-foreground min-h-screen flex items-center justify-center") do
          div(class: "w-full max-w-lg space-y-8") do
            render_header
            render_progress
            render_step_content
          end
        end
      end
    end

    private

    def render_header
      div(class: "text-center space-y-2") do
        h1(class: "text-2xl font-bold text-foreground") { "Set up your site" }
        p(class: "text-sm text-foreground/60") { "Let's get #{@site.name} ready in a few steps." }
      end
    end

    def render_progress
      steps = [
        { key: "welcome", label: "Welcome" },
        { key: "theme", label: "Theme" },
        { key: "settings", label: "Settings" },
        { key: "complete", label: "Done" }
      ]

      div(class: "flex items-center justify-center gap-2") do
        steps.each_with_index do |step, i|
          active = step[:key] == @step
          done = steps.index { |s| s[:key] == @step } > i

          if active
            span(class: "h-2 w-8 rounded-full bg-primary")
          elsif done
            span(class: "h-2 w-8 rounded-full bg-emerald-500")
          else
            span(class: "h-2 w-8 rounded-full bg-muted")
          end
        end
      end
    end

    def render_step_content
      div(class: "rounded-xl border border-border bg-card p-6") do
        case @step
        when "welcome"
          render_welcome_step
        when "theme"
          render_theme_step
        when "settings"
          render_settings_step
        when "complete"
          render_complete_step
        end
      end
    end

    def render_welcome_step
      div(class: "space-y-6") do
        div(class: "space-y-2") do
          h2(class: "text-lg font-semibold text-foreground") { "Welcome to #{@site.name}" }
          p(class: "text-sm text-foreground/60") { "Your site has been created. Let's set it up." }
        end

        form_with(url: onboarding_path(step: "welcome"), method: :post, class: "space-y-4") do |f|
          div(class: "space-y-1.5") do
            label(for: "site_name", class: "block text-sm font-medium text-foreground") { "Site name" }
            f.text_field :site_name, value: @site.name, class: "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20", required: true
          end

          div(class: "flex justify-end") do
            f.submit "Continue", class: "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
          end
        end
      end
    end

    def render_theme_step
      div(class: "space-y-6") do
        div(class: "space-y-2") do
          h2(class: "text-lg font-semibold text-foreground") { "Choose a theme" }
          p(class: "text-sm text-foreground/60") { "Select a theme for your site. You can change this later." }
        end

        form_with(url: onboarding_path(step: "theme"), method: :post, class: "space-y-4") do |f|
          div(class: "space-y-3") do
            Theme.discover.each do |theme|
              label(class: "flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50") do
                f.radio_button :active_theme, theme[:slug], class: "h-4 w-4 border-border text-primary focus:ring-ring/20"
                div do
                  p(class: "text-sm font-medium text-foreground") { theme[:name] || theme[:slug].titleize }
                  p(class: "text-xs text-foreground/50") { theme[:description] } if theme[:description]
                end
              end
            end
          end

          div(class: "flex justify-between pt-4") do
            a(href: onboarding_path(step: "welcome"), class: "text-sm text-foreground/60 hover:text-foreground") { "Back" }
            f.submit "Continue", class: "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
          end
        end
      end
    end

    def render_settings_step
      div(class: "space-y-6") do
        div(class: "space-y-2") do
          h2(class: "text-lg font-semibold text-foreground") { "Site settings" }
          p(class: "text-sm text-foreground/60") { "Confirm your site name and add a tagline." }
        end

        form_with(url: onboarding_path(step: "settings"), method: :post, class: "space-y-4") do |f|
          div(class: "space-y-1.5") do
            label(for: "site_name", class: "block text-sm font-medium text-foreground") { "Site name" }
            f.text_field :site_name, value: @site.name, class: "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20", placeholder: "My Blog"
          end

          div(class: "space-y-1.5") do
            label(for: "tagline", class: "block text-sm font-medium text-foreground") { "Tagline" }
            f.text_field :tagline, class: "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20", placeholder: "A short description of your site"
          end

          div(class: "flex justify-between pt-4") do
            a(href: onboarding_path(step: "theme"), class: "text-sm text-foreground/60 hover:text-foreground") { "Back" }
            f.submit "Continue", class: "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
          end
        end
      end
    end

    def render_complete_step
      div(class: "space-y-6 text-center") do
        div(class: "mx-auto h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center") do
          span(class: "text-3xl text-emerald-500") { "✓" }
        end

        div(class: "space-y-2") do
          h2(class: "text-lg font-semibold text-foreground") { "You're all set!" }
          p(class: "text-sm text-foreground/60") { "#{@site.name} is ready. Start creating content." }
        end

        a(href: main_app.admin_root_path, class: "inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90") { "Go to dashboard" }
      end
    end
  end
end
