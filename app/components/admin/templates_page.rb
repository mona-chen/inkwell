# frozen_string_literal: true
module Admin
  class TemplatesPage < ApplicationComponent
    def initialize(template_definitions:, templates: {})
      @template_definitions, @templates = template_definitions, templates
    end

    def view_template
      render Toolbar.new do |bar|
        bar.leading { render ToolbarTitle.new(title: "Templates", subtitle: "Design how posts, archives, and author pages appear.") }
      end
      render DesignNavigation.new(current: "templates")
      div(class: "design-note") { "The theme default stays live until you publish a template. Save keeps template edits as a working draft. Reset restores the theme default and keeps your design as a draft page." }
      @template_definitions.each { |definition| render_template_row(definition) }
    end

    private

    def render_template_row(definition)
      page = @templates[definition[:role]]
      section(class: "design-row") do
        div do
          div(class: "flex flex-wrap items-center gap-2 mb-1") do
            h2 { definition[:label] }
            render Badge.new(page&.status == "published" ? "Live" : page ? "Draft" : "Theme default", color: page&.status == "published" ? :success : :neutral, size: :xs)
            render Badge.new("Unpublished changes", color: :neutral, size: :xs) if page&.draft_content.present?
          end
          p { definition[:description] }
          p(class: "mt-1") { "Provided by #{definition[:plugin]}" } if definition[:plugin].present?
        end
        div(class: "design-row-actions") do
          if page
            render Button.new("Preview draft", href: "/builder/page/#{page.id}/preview", variant: :ghost, size: :sm, icon: :eye)
            render Button.new("Edit template", href: "/builder/page/#{page.id}", variant: :outline, size: :sm)
            if page.draft_content.present?
              render ButtonTo.new("Discard changes", href: admin_discard_template_draft_path(definition[:role]), method: :delete, variant: :ghost, size: :sm, data: { turbo_confirm: "Discard unpublished template changes?" })
            end
            render ButtonTo.new("Reset", href: admin_reset_template_path(definition[:role]), method: :delete, variant: :ghost, size: :sm, data: { turbo_confirm: "Restore the theme default? Your design will be kept as a draft page." })
          else
            render ButtonTo.new("Create template", href: admin_create_template_path(definition[:role]), method: :post, variant: :outline, size: :sm, icon: :plus)
          end
        end
      end
    end

  end
end
