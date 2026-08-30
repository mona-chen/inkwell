module Admin
  class WebsiteImportsPage < ApplicationComponent
    def initialize(imports:)
      @imports = imports
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading { render ToolbarTitle.new(title: "Website imports", subtitle: "Capture, review, and convert complete websites") }
        toolbar.trailing { render Button.new("Import website", href: new_admin_website_import_path, variant: :primary, icon: :globe) }
      end

      if @imports.empty?
        render EmptyState.new(title: "No website imports yet", description: "Enter a website URL to capture its pages and convert them into editable Builder elements.") do |state|
          state.action(Button.new("Import a website", href: new_admin_website_import_path, icon: :globe))
        end
      else
        div(class: "overflow-hidden rounded-xl border border-border bg-background") do
          ul(class: "divide-y divide-border") { @imports.each { |item| import_row(item) } }
        end
      end
    end

    private

    def import_row(item)
      li do
        a(href: admin_website_import_path(item), class: "group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30") do
          span(class: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground") { render Icon.new(:globe, size: :sm) }
          div(class: "min-w-0 flex-1") do
            div(class: "flex items-center gap-2") do
              strong(class: "truncate text-sm font-medium text-foreground") { item.source_url }
              render Badge.new(item.status, color: status_color(item), size: :xs)
            end
            p(class: "mt-1 text-xs text-muted-foreground") { "#{item.mapped_pages} mapped pages · #{item.created_at.strftime('%b %-d, %Y at %-I:%M %p')}" }
          end
          render Icon.new(:chevron_right, size: :xs)
        end
      end
    end

    def status_color(item)
      return :success if item.status == "imported" || item.status == "ready"
      return :danger if item.status == "failed"
      :neutral
    end
  end
end
