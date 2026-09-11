# frozen_string_literal: true

module Multisite
  module Admin
    # Compact site-switcher for the admin topbar. Mirrors Ink::Dropdown's trigger + menu
    # styling and data contract (`dropdown` controller, `toggle` action, `menu` target) so
    # it needs no bespoke CSS. Only rendered when the current user can access > 1 site.
    class SiteSwitcher < ApplicationComponent
      include Multisite::RouteHelpers
      include Phlex::Rails::Helpers::ButtonTo

      def initialize(current_site:, accessible_sites:, current_user:)
        @current_site = current_site
        @accessible_sites = accessible_sites
        @current_user = current_user
      end

      def view_template
        return unless @accessible_sites.size > 1

        div(
          class: "relative",
          data: { controller: "dropdown", action: "keydown.esc@window->dropdown#close" }
        ) do
          button(
            type: "button",
            class: "inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50 hover:bg-muted hover:text-foreground",
            data: { action: "click->dropdown#toggle" },
            aria: { label: "Switch site", expanded: "false", haspopup: "menu" }
          ) do
            render Icon.new(:globe_2, size: :sm)
            span(class: "max-w-[10rem] truncate") { @current_site&.name || "Select site" }
            render Icon.new(:chevron_down, size: :xs)
          end

          div(
            class: "absolute left-0 top-full z-50 mt-2 hidden min-w-56 overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl shadow-black/10",
            data: { dropdown_target: "menu" },
            role: "menu"
          ) do
            div(class: "border-b border-border px-2.5 py-2") do
              div(class: "text-xs font-semibold text-muted-foreground") { "Switch site" }
            end
            @accessible_sites.each do |site|
              menu_item(site)
            end
          end
        end
      end

      private

      def menu_item(site)
        active = site.id == @current_site.id
        item_class = "relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground"
        item_class += " bg-accent font-semibold" if active

        if active
          div(class: item_class, aria: { current: "true" }) do
            span(class: "h-2 w-2 rounded-full bg-emerald-500")
            span(class: "truncate") { site.name }
            span(class: "ml-auto text-xs text-muted-foreground") { "current" }
          end
        else
          button_to(
            multisite_routes.admin_site_switcher_path(site_id: site.id),
            class: item_class,
            data: { turbo: false }
          ) do
            span(class: "h-2 w-2 rounded-full bg-muted-foreground")
            span(class: "truncate") { site.name }
          end
        end
      end
    end
  end
end
