module Admin
  class WebsiteImportPage < ApplicationComponent
    def initialize(website_import:)
      @website_import = website_import
    end

    def view_template
      div(data: refresh_data) do
        render Toolbar.new do |toolbar|
          toolbar.leading do
            div(class: "flex items-center gap-2") do
              render Button.new(href: admin_website_imports_path, variant: :ghost, size: :sm, icon: :arrow_left, aria: { label: "Back to website imports" })
              render ToolbarTitle.new(title: "Website import", subtitle: @website_import.source_url)
            end
          end
          toolbar.trailing do
            if @website_import.ready?
              render ButtonTo.new("Import editable pages", href: admin_website_import_application_path(@website_import), method: :post, variant: :primary, icon: :download)
            elsif @website_import.status == "imported" && @website_import.imported_page_ids.first
              render Button.new("Open first page", href: "/builder/page/#{@website_import.imported_page_ids.first}", variant: :primary, icon: :external_link)
            else
              render Button.new("Refresh status", href: admin_website_import_path(@website_import), variant: :ghost, icon: :refresh_cw)
            end
          end
        end

        section(class: "overflow-hidden rounded-xl border border-border bg-background") do
          div(class: "flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between") do
            div do
              div(class: "flex items-center gap-2") do
                h2(class: "text-sm font-semibold text-foreground") { status_title }
                render Badge.new(@website_import.status, color: status_color, size: :xs)
              end
              p(class: "mt-1 text-sm text-muted-foreground") { status_description }
            end
            span(class: "text-sm font-medium tabular-nums text-foreground") { "#{@website_import.progress}%" }
          end
          div(class: "h-1.5 bg-muted") do
            div(class: "h-full bg-primary transition-all", style: "width: #{@website_import.progress}%")
          end
          dl(class: "grid gap-px bg-border sm:grid-cols-3") do
            metric("Captured routes", @website_import.captured_pages)
            metric("Mapped pages", @website_import.mapped_pages)
            metric("Crawl limit", @website_import.max_pages)
          end
          if @website_import.error_message.present?
            div(class: "border-t border-danger/30 bg-danger/10 px-5 py-4") do
              h3(class: "text-sm font-medium text-danger") { "Import failed" }
              pre(class: "mt-2 whitespace-pre-wrap break-words text-xs text-danger") { @website_import.error_message }
            end
          end
        end

        if @website_import.ready?
          div(class: "mt-6 rounded-xl border border-success/30 bg-success/5 p-5") do
            h2(class: "text-sm font-semibold text-foreground") { "Ready to create native pages" }
            p(class: "mt-1 text-sm text-muted-foreground") { "Review complete. Importing creates separate editable draft pages, preserves internal links, and installs shared header and footer parts. Existing pages are not overwritten." }
          end
        end
      end
    end

    private

    def refresh_data
      @website_import.active? ? { controller: "refresh", refresh_interval_value: 2500 } : {}
    end

    def metric(label, value)
      div(class: "bg-background px-5 py-4") do
        dt(class: "text-xs text-muted-foreground") { label }
        dd(class: "mt-1 text-lg font-semibold tabular-nums text-foreground") { value }
      end
    end

    def status_title
      { "queued" => "Waiting to start", "capturing" => "Capturing the website", "mapping" => "Converting to native elements", "ready" => "Capture ready", "importing" => "Creating pages", "imported" => "Website imported", "failed" => "Capture stopped" }.fetch(@website_import.status)
    end

    def status_description
      { "queued" => "The capture job is queued.", "capturing" => "Following authorized internal routes and recording responsive design evidence.", "mapping" => "Translating structure, styles, media, links, and motion into Builder data.", "ready" => "The mapped site is ready for your approval.", "importing" => "Creating editable pages and shared site parts.", "imported" => "The editable draft pages are available in Ink Builder.", "failed" => "Review the error below, then start a new capture after correcting the source." }.fetch(@website_import.status)
    end

    def status_color
      return :success if %w[ready imported].include?(@website_import.status)
      return :destructive if @website_import.status == "failed"
      :neutral
    end
  end
end
