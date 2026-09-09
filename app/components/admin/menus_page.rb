# frozen_string_literal: true

module Admin
  # Menus index: toolbar, then a card grid of the site's menus with their item
  # counts and a link into each menu's builder. Rendered from
  # Admin::MenusController#index.
  class MenusPage < ApplicationComponent
    def initialize(menus:)
      @menus = menus
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: "Navigation",
            subtitle: "Shape the primary paths through your site"
          )
        end
      end

      render Grid.new(cols: "1 lg:2", gap: 4) do
        @menus.each do |menu|
          render Card.new do |card|
            card.title do
              Flex(dir: :row, gap: 2, align: :center) do
                span(class: "flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary") { render Icon.new(menu.location == "header" ? :panel_top : :panel_bottom, size: :sm) }
                div do
                  div(class: "text-sm font-semibold text-foreground") { menu.name }
                  div(class: "mt-0.5 text-[11px] uppercase tracking-[.12em] text-muted-foreground") { menu.location }
                end
              end
            end
            card.body do
              p(class: "min-h-10 text-xs leading-5 text-muted-foreground") do
                menu.location == "header" ? "The main navigation visitors use across the top of the site." : "Secondary links shown with legal and supporting information at the bottom."
              end
            end
            card.footer do
              div(class: "flex w-full items-center justify-between") do
                span(class: "text-xs text-muted-foreground") { pluralize(menu.menu_items.count, "item") }
                render Button.new("Edit menu", href: admin_menu_path(menu), variant: :default, size: :sm, icon: :arrow_right)
              end
            end
          end
        end
      end
    end
  end
end
