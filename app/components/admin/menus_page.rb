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
            title: "Menus",
            subtitle: "Menus appear in the header and footer of your site."
          )
        end
      end

      render Grid.new(cols: "1 sm:2", gap: 4) do
        @menus.each do |menu|
          render Card.new do |card|
            card.title(menu.name)
            card.body do
              p(class: "text-xs text-muted-foreground mb-3") { pluralize(menu.menu_items.count, "item") }
              a(href: admin_menu_path(menu), class: "text-sm text-foreground hover:text-primary hover:underline") do
                "Edit menu →"
              end
            end
          end
        end
      end
    end
  end
end
