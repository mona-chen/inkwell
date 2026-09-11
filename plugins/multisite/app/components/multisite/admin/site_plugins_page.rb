# frozen_string_literal: true

module Multisite
  module Admin
    class SitePluginsPage < ApplicationComponent
      include Multisite::RouteHelpers

      def initialize(site:, plugins:, activations:, mode:)
        @site = site
        @plugins = plugins
        @activations = activations
        @mode = mode
      end

      def view_template
        render Toolbar.new do |toolbar|
          toolbar.leading do
            render ToolbarTitle.new(
              title: "Plugins — #{@site.name}",
              subtitle: "Per-site plugin activation"
            )
          end
          toolbar.trailing do
            render Button.new("Back to Sites", href: multisite_routes.admin_sites_path, variant: :ghost, size: :sm)
          end
        end

        render_mode_selector

        render Grid.new(cols: "1 sm:2 lg:3", gap: 4) do
          @plugins.each do |plugin|
            render plugin_card(plugin)
          end
        end
      end

      private

      # The multisite creator configures how activation is decided for this site:
      # per-site (toggle each plugin here) or global (the platform flag decides).
      def render_mode_selector
        Card.new do |card|
          card.body do
            Flex(dir: :row, gap: 4, align: :center, wrap: true) do
              div(class: "flex-1 min-w-64") do
                div(class: "text-sm font-semibold text-foreground") { "How should plugins be activated here?" }
                div(class: "mt-0.5 text-sm text-muted-foreground") do
                  if @mode == "global"
                    "This site follows the platform's global activation for every plugin."
                  else
                    "This site only runs plugins you toggle on below (new sites inherit the platform defaults)."
                  end
                end
              end
              form_with(url: multisite_routes.set_mode_admin_site_plugins_path(@site), method: :post, class: "flex items-center gap-3") do
                select(
                  name: "mode",
                  class: "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                ) do
                  option(value: "per_site", selected: (@mode != "global")) { "Per-site (per plugin)" }
                  option(value: "global", selected: (@mode == "global")) { "Global (platform-wide)" }
                end
                button(
                  type: "submit",
                  class: "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-xs hover:bg-accent"
                ) { "Save" }
              end
            end
          end
        end
      end

      def plugin_card(plugin)
        activation = @activations[plugin.id]
        # Opt-out semantics: an unmanaged plugin (no row) is already on.
        is_active = activation.blank? || activation.active?
        is_managed = activation.present?

        Card.new do |card|
          card.title do
            Flex(dir: :row, gap: 2, align: :center) do
              span(class: "flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground") do
                render Icon.new(:puzzle, size: :sm)
              end
              div(class: "min-w-0 flex-1") do
                div(class: "truncate text-base font-semibold text-foreground") { plugin.name }
                render Badge.new("v#{plugin.version}", variant: :outline, size: :xs)
              end
            end
          end
          card.body do
            div(class: "min-h-[3.5rem] text-sm leading-relaxed text-muted-foreground") do
              Inkwell::PluginManager.find(plugin.slug)&.plugin_description
            end
            div(class: "mt-3") do
              render Badge.new(is_active ? "Active" : "Inactive", color: is_active ? :success : :neutral)
            end
          end
          card.footer do
            if is_active
              render ButtonTo.new(
                "Deactivate",
                href: multisite_routes.deactivate_admin_site_plugin_path(@site, plugin.slug),
                method: :post,
                variant: :default
              )
            else
              render ButtonTo.new(
                "Activate",
                href: multisite_routes.activate_admin_site_plugin_path(@site, plugin.slug),
                method: :post,
                variant: :primary
              )
            end
          end
        end
      end
    end
  end
end
