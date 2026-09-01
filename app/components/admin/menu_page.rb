# frozen_string_literal: true

module Admin
  # Menu builder: drag-reorder the menu's items (menu_builder stimulus) and add
  # new items inline. Rendered from Admin::MenusController#show.
  class MenuPage < ApplicationComponent
    def initialize(menu:)
      @menu = menu
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: @menu.name,
            subtitle: pluralize(@menu.menu_items.count, "item")
          )
        end
        toolbar.trailing do
          render Button.new("All menus", href: admin_menus_path, variant: :ghost)
        end
      end

      render Card.new do |card|
        card.body do
          div(data: { controller: "menu-builder", menu_builder_menu_id_value: @menu.id }) do
            ul(data: { menu_builder_target: "list" }, class: "space-y-2 mb-4") do
              @menu.menu_items.each do |item|
                li(
                  data: { menu_builder_target: "item", item_id: item.id },
                  class: "flex items-center gap-2 bg-background border rounded-lg px-3 py-2 text-sm"
                ) do
                  span(class: "cursor-grab text-muted-foreground") { "⠿" }
                  span(class: "flex-1 text-foreground") { item.label }
                  span(class: "text-muted-foreground text-xs") { item.resolved_url }
                  render ButtonTo.new(
                    "✕",
                    href: admin_menu_menu_item_path(@menu, item),
                    method: :delete,
                    variant: :ghost,
                    size: :xs,
                    button_aria: { label: "Delete item" }
                  )
                end
              end
            end
          end

          form_with(
            model: MenuItem.new,
            url: admin_menu_menu_items_path(@menu),
            local: true,
            builder: Ink::FormBuilder
          ) do |f|
            f.group do
              f.field(:label, placeholder: "Label")
              f.field(:url, placeholder: "https://…")
              f.submit("Add")
            end
          end
        end
      end
    end
  end
end
