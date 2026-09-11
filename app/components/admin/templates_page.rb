# frozen_string_literal: true

module Admin
  # Lists the content-type templates a site can design in the Builder (core roles plus any
  # registered by plugins) and lets an admin create or edit each one.
  class TemplatesPage < ApplicationComponent
    def initialize(template_definitions:, templates: {})
      @template_definitions = template_definitions
      @templates = templates
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: "Content templates",
            subtitle: "Design how your content renders with the Builder"
          )
        end
      end

      p(class: "mb-4 text-sm text-muted-foreground") do
        "A content template replaces the theme's default rendering for a content type. Design it in the Builder like any other page."
      end

      if @template_definitions.any?
        div(class: "space-y-2") do
          @template_definitions.each { |definition| render_template_row(definition) }
        end
      else
        render EmptyState.new(
          title: "No content templates",
          description: "Install a plugin that registers a content type to see templates here.",
          icon: :layout
        )
      end
    end

    private

    def render_template_row(definition)
      role = definition[:role]
      page = @templates[role]

      div(class: "flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3") do
        div(class: "flex min-w-0 items-center gap-3") do
          span(class: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground") do
            render Icon.new(definition[:icon] || "file", size: :sm)
          end
          div(class: "min-w-0") do
            div(class: "flex items-center gap-2") do
              p(class: "text-sm font-medium text-foreground") { definition[:label] || role.humanize }
              if definition[:plugin].present?
                span(class: "inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground") { definition[:plugin] }
              end
            end
            p(class: "truncate text-xs text-muted-foreground") { page ? "Built by #{page.title}" : definition[:description] }
          end
        end
        div(class: "shrink-0") do
          if page
            render Button.new("Edit in Builder", href: "/builder/page/#{page.id}", variant: :ghost, size: :sm, icon: :layout)
          else
            render ButtonTo.new("Create", href: admin_create_template_path(role), method: :post, variant: :primary, size: :sm, icon: :plus)
          end
        end
      end
    end
  end
end
