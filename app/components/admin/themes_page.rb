# frozen_string_literal: true

module Admin
  # Themes index: toolbar showing the active theme, then a grid of theme cards with
  # an active indicator, a preview link, and an activate action. Rendered from
  # Admin::ThemesController#index.
  class ThemesPage < ApplicationComponent
    def initialize(themes:, active_theme:)
      @themes = themes
      @active_theme = active_theme
    end

    def view_template
      div(class: "themes-library") do
        header(class: "themes-heading") do
          div do
            p(class: "themes-eyebrow") { "SITE DESIGN" }
            h1 { "Theme packages" }
            p(class: "themes-intro") { "Install, preview, and activate your site’s frontend." }
          end
          if Current.user&.admin?
            render Button.new("Import a theme", href: "#theme-import", variant: :primary, icon: :download)
          end
        end

        render DesignNavigation.new(current: "themes")
        div(class: "themes-section-heading") do
          h2 { "Your themes" }
          span { "#{@themes.size} installed" }
        end
        div(class: "themes-cards") { @themes.each { |theme| theme_card(theme) } }
        import_panel if Current.user&.admin?
      end
    end

    private

    def import_panel
      section(id: "theme-import", class: "themes-import") do
        div(class: "themes-import-intro") do
          span(class: "themes-import-icon") { render Icon.new(:download, size: :sm) }
          h2 { "Import a theme package" }
          p { "Install a Rails theme, a static website, or a bundled app from a ZIP file." }
          div(class: "themes-formats") do
            span { "Rails + Hotwire" }
            span { "HTML / CSS / JS" }
            span { "React & other bundles" }
          end
        end
        form_with(url: import_admin_themes_path, multipart: true, class: "themes-import-form", data: { turbo: false }) do |form|
          form.label :archive, "Theme package", class: "themes-field-label"
          div(class: "themes-file") do
            form.file_field :archive, accept: ".zip", required: true
          end
          p(class: "themes-help") { "ZIP archive · up to 200 MB" }
          details(class: "themes-options") do
            summary { "Routing options" }
            div(class: "themes-routing") do
              form.check_box :spa
              div do
                form.label :spa, "Enable client-side routing"
                p { "For single-page apps without a theme.json manifest. Keeps nested URLs working on refresh." }
              end
            end
          end
          div(class: "themes-import-footer") do
            p { "Import first. Preview before going live." }
            render Button.new("Import theme", type: :submit, variant: :primary, icon: :download)
          end
        end
      end
    end

    def theme_card(theme)
      slug = theme[:slug]
      active = slug == @active_theme
      manifest = ThemeManager.manifest(slug)
      packaged = manifest["format"] == "inkwell-theme-v1"
      article(class: "themes-card#{active ? ' is-active' : ''}") do
        div(class: "themes-package-mark", aria: { hidden: "true" }) do
          render Icon.new(packaged ? :package : :palette, size: :lg)
          span { packaged ? manifest["kind"].to_s.capitalize : "Rails theme" }
        end
        div(class: "themes-card-content") do
          div(class: "themes-card-title") do
            h3 { theme[:name] || theme["name"] }
            render Badge.new("Active", color: :success, size: :xs) if active
          end
          p(class: "themes-description") { theme[:description] || theme["description"] }
          if packaged
            p(class: "themes-help") { "#{manifest['kind'].capitalize} · #{manifest.fetch('routes', {}).size} routes#{manifest['spa_fallback'] ? ' · Client-side routing' : ''}" }
            dependencies = ThemePackages::Dependencies.new(manifest.fetch("dependencies", {}))
            if dependencies.gems.any? || dependencies.packages.any?
              details(class: "themes-options") do
                summary { "Dependencies" }
                pre { JSON.pretty_generate(dependencies.data) }
                p(class: "themes-help") { "Install gems and build packages separately before activation. Gems require a server restart." }
              end
            end
          end
        end
        footer(class: "themes-card-footer") do
          render Button.new("Preview", href: preview_admin_theme_path(slug), variant: :ghost, icon: :eye)
          if active
            span(class: "themes-current") { "Currently on your site" }
          else
            render ButtonTo.new("Activate", href: activate_admin_theme_path(slug), method: :post, variant: :primary)
          end
        end
      end
    end
  end

  # Theme preview: renders the live site in an iframe with the ?preview_theme=<slug>
  # param so admins can preview a theme without activating it. Rendered from
  # Admin::ThemesController#preview.
  class ThemePreviewPage < ApplicationComponent
    def initialize(slug:)
      @slug = slug
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          div do
            h1(class: "text-2xl font-bold tracking-tight") { "Theme preview" }
            p(class: "text-sm text-muted-foreground mt-1") { "#{@slug.titleize} · Theme defaults preview. Your published template assignments stay unchanged." }
          end
        end
        toolbar.trailing do
          render Button.new("Back to themes", href: admin_themes_path, variant: :ghost)
        end
      end

      render Card.new do |card|
        card.body do
          iframe(src: root_path(preview_theme: @slug, theme_home: "1"), title: "#{@slug.titleize} theme preview", class: "w-full h-[80vh]")
        end
      end
    end
  end
end
