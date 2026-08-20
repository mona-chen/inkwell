# frozen_string_literal: true

module Admin
  # Plugins index: toolbar with the count, then a grid of plugin cards showing the
  # name, description, version, activation state, and an activate/deactivate action.
  # Rendered from Admin::PluginsController#index.
  class PluginsPage < ApplicationComponent
    def initialize(plugins:)
      @plugins = plugins
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: "Plugins",
            subtitle: pluralize(@plugins.size, "plugin")
          )
        end
      end

      render Grid.new(cols: "1 sm:2 lg:3", gap: 4) do
        @plugins.each do |plugin|
          render plugin_card(plugin)
        end
      end
    end

    private

    def plugin_card(plugin)
      Card.new do |card|
        card.title do
          Flex(dir: :row, gap: 2, align: :center) do
            span(class: "flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground") do
              render Icon.new(:puzzle, size: :sm)
            end
            span(class: "text-base font-semibold text-foreground") { plugin.name }
            render Badge.new("v#{plugin.version}", variant: :outline, size: :xs)
          end
        end
        card.body do
          div(class: "min-h-[3.5rem] text-sm leading-relaxed text-muted-foreground") do
            Inkwell::PluginManager.find(plugin.slug)&.plugin_description
          end
          div(class: "mt-3") do
            render Badge.new(plugin.active? ? "Active" : "Inactive", color: plugin.active? ? :success : :neutral)
          end
        end
        card.footer do
          if plugin.active?
            render ButtonTo.new(
              "Deactivate",
              href: deactivate_admin_plugin_path(plugin.slug),
              method: :post,
              variant: :default
            )
          else
            render ButtonTo.new(
              "Activate",
              href: activate_admin_plugin_path(plugin.slug),
              method: :post,
              variant: :primary
            )
          end
        end
      end
    end
  end
end
