# frozen_string_literal: true

module Admin
  # Menu builder: drag-reorder the menu's items (menu_builder stimulus) and add
  # new items inline. Rendered from Admin::MenusController#show.
  class MenuPage < ApplicationComponent
    def initialize(menu:, pages: [])
      @menu = menu
      @pages = pages
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: "#{@menu.name} navigation",
            subtitle: "#{pluralize(@menu.menu_items.count, "item")} · drag to reorder, edit inline"
          )
        end
        toolbar.trailing do
          render Flex.new(dir: :row, gap: 2) do
            render Button.new("View site", href: root_path, variant: :ghost, size: :sm, icon: :external_link, target: "_blank")
            render Button.new("All menus", href: admin_menus_path, variant: :default, size: :sm)
          end
        end
      end

      render Grid.new(cols: "1 xl:3", gap: 5) do
        div(class: "xl:col-span-2") do
          render Card.new do |card|
            card.title { "Menu structure" }
            card.body do
              if @menu.menu_items.empty?
                render EmptyState.new(title: "This menu is empty", description: "Add a page or custom link to create the first navigation item.", level: 3, variant: :borderless)
              else
                div(data: { controller: "menu-builder", menu_builder_menu_id_value: @menu.id }) do
                  ul(data: { menu_builder_target: "list" }, class: "space-y-2") do
                    @menu.menu_items.each { |item| render_item(item) }
                  end
                end
              end
            end
          end
        end

        div do
          render Card.new do |card|
            card.title { "Add navigation item" }
            card.body do
              form_with(model: MenuItem.new, url: admin_menu_menu_items_path(@menu), local: true, class: "space-y-3") do |f|
                field(f, :page_id, "Link to a page") do
                  f.select :page_id, @pages.map { |page| [page.title, page.id] }, { include_blank: "Custom link…" }, class: input_class
                end
                field(f, :label, "Label") { f.text_field :label, placeholder: "Navigation label", class: input_class }
                field(f, :url, "Custom URL") { f.text_field :url, placeholder: "https://… or /path", class: input_class }
                field(f, :parent_id, "Parent item") do
                  f.select :parent_id, root_item_options, { include_blank: "Top level" }, class: input_class
                end
                p(class: "text-[11px] leading-4 text-muted-foreground") { "Choose a page or enter a custom URL. A custom label can override the page title." }
                f.submit "Add item", class: "inline-flex h-8 w-full items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              end
            end
          end
        end
      end
    end

    private

    def render_item(item)
      li(data: { menu_builder_target: "item", item_id: item.id }, class: "rounded-xl border border-border bg-background p-3") do
        form_with(model: item, url: admin_menu_menu_item_path(@menu, item), method: :patch, local: true, class: "grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]") do |f|
          span(class: "cursor-grab self-center text-muted-foreground", title: "Drag to reorder", aria: { hidden: true }) { "⠿" }
          div(class: "min-w-0") do
            f.label :label, "Label", class: "mb-1 block text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground"
            f.text_field :label, class: input_class
          end
          div(class: "min-w-0") do
            f.label :url, "Destination", class: "mb-1 block text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground"
            f.text_field :url, value: item.url, placeholder: item.resolved_url, class: input_class
          end
          div(class: "flex items-end gap-1") do
            f.submit "Save", class: "inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-muted"
            render ButtonTo.new("Remove", href: admin_menu_menu_item_path(@menu, item), method: :delete, variant: :ghost, size: :sm, button_aria: { label: "Remove #{item.label}" }, data: { turbo_confirm: "Remove #{item.label} from this menu?" })
          end
          div(class: "sm:col-start-2 sm:col-span-2") do
            f.label :parent_id, "Nest under", class: "mb-1 block text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground"
            f.select :parent_id, root_item_options(except: item), { include_blank: "Top level", selected: item.parent_id }, class: input_class
          end
        end
      end
    end

    def root_item_options(except: nil)
      @menu.menu_items.select { |item| item.parent_id.nil? && item != except }.map { |item| [item.label, item.id] }
    end

    def field(form, name, label)
      div do
        form.label name, label, class: "mb-1 block text-xs font-medium text-muted-foreground"
        yield
      end
    end

    def input_class
      "h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
    end
  end
end
