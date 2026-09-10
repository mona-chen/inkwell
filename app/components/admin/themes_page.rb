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
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: "Themes",
            subtitle: "Currently active: #{@active_theme}"
          )
        end
      end

      render Grid.new(cols: "1 sm:2 lg:3", gap: 6) do
        @themes.each do |theme|
          render theme_card(theme)
        end
      end
    end

    private

    def theme_card(theme)
      name = theme[:name] || theme["name"]
      description = theme[:description] || theme["description"]
      Card.new do |card|
        card.title do
          Flex(dir: :row, gap: 2, align: :center) do
            span(class: "flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground") do
              render Icon.new(:palette, size: :sm)
            end
            span(class: "text-sm font-semibold text-foreground") { name }
            if theme[:slug] == @active_theme
              render Badge.new("Active", color: :success, size: :xs)
            end
          end
        end
        card.body do
          p(class: "min-h-[2.5rem] text-xs leading-5 text-muted-foreground") { description }
        end
        card.footer do
          render Grid.new(cols: "1 sm:2", gap: 3) do
            render Button.new("Preview", href: preview_admin_theme_path(theme[:slug]), variant: :ghost, icon: :eye)
            unless theme[:slug] == @active_theme
              render ButtonTo.new(
                "Activate",
                href: activate_admin_theme_path(theme[:slug]),
                method: :post,
                variant: :primary
              )
            end
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
            p(class: "text-sm text-muted-foreground mt-1") { @slug }
          end
        end
        toolbar.trailing do
          render Button.new("Back to themes", href: admin_themes_path, variant: :ghost)
        end
      end

      render Card.new do |card|
        card.body do
          iframe(src: root_path(preview_theme: @slug), class: "w-full h-[80vh]")
        end
      end
    end
  end
end
