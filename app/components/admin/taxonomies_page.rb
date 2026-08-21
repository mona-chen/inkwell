# frozen_string_literal: true

module Admin
  # Category / tag management (WordPress taxonomy manager equivalent).
  class TaxonomiesPage < ApplicationComponent
    def initialize(terms:, taxonomy:)
      @terms = terms
      @taxonomy = taxonomy
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(
            title: @taxonomy.titleize,
            subtitle: "Organize content with #{@taxonomy.pluralize}"
          )
        end
        toolbar.trailing do
          render Flex.new(dir: :row, gap: 2) do
            render Button.new("Categories", href: admin_taxonomies_path(taxonomy: "category"), variant: @taxonomy == "category" ? :primary : :ghost, size: :sm)
            render Button.new("Tags", href: admin_taxonomies_path(taxonomy: "tag"), variant: @taxonomy == "tag" ? :primary : :ghost, size: :sm)
          end
        end
      end

      Grid(cols: "1 lg:3", gap: 6) do
        div(class: "lg:col-span-2") do
          render Card.new do |card|
            card.title { @taxonomy.pluralize }
            card.body do
              if @terms.empty?
                div(class: "py-8 text-center text-sm text-muted-foreground") { "No #{@taxonomy.pluralize} yet — add your first one." }
              else
                ul(class: "divide-y divide-border") do
                  @terms.each { |term| render_term_row(term) }
                end
              end
            end
          end
        end

        div(class: "lg:col-span-1") do
          render Card.new do |card|
            card.title { "Add #{@taxonomy.singularize}" }
            card.body do
              form_with(url: admin_taxonomies_path(taxonomy: @taxonomy), method: :post, class: "space-y-3") do |f|
                div do
                  f.label :name, "Name", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.text_field :name, class: "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20", autofocus: true
                end
                div do
                  f.label :slug, "Slug (optional)", class: "mb-1 block text-xs font-medium text-muted-foreground"
                  f.text_field :slug, class: "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                end
                f.submit "Add #{@taxonomy.singularize}", class: "w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer"
              end
            end
          end
        end
      end
    end

    private

    def render_term_row(term)
      li(class: "py-3") do
        form_with(model: term, url: admin_taxonomy_path(term, taxonomy: @taxonomy), method: :patch, class: "flex items-center gap-3") do |f|
          f.text_field :name, value: term.name, class: "flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-foreground focus:border-border focus:bg-background focus:outline-none"
          span(class: "text-xs text-muted-foreground") { "· #{term.post_terms.count} used" }
          f.submit "Save", class: "rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          render ButtonTo.new(
            "Delete",
            href: admin_taxonomy_path(term, taxonomy: @taxonomy),
            method: :delete,
            variant: :ghost,
            size: :xs,
            data: { turbo_confirm: "Delete this #{@taxonomy.singularize}? Posts keep their content." }
          )
        end
      end
    end
  end
end
