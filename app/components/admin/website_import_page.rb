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
              render ButtonTo.new("Import #{@website_import.mapped_pages} editable pages", href: admin_website_import_application_path(@website_import), method: :post, variant: :primary, icon: :download)
            elsif @website_import.status == "imported" && @website_import.imported_page_ids.first
              render Button.new("Open first page", href: "/builder/page/#{@website_import.imported_page_ids.first}", variant: :primary, icon: :external_link)
            elsif @website_import.retryable?
              render ButtonTo.new("Retry capture", href: retry_admin_website_import_path(@website_import), method: :post, variant: :primary, icon: :refresh_cw)
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
                render Badge.new(@website_import.empty_capture? ? "failed" : @website_import.status, color: status_color, size: :xs)
              end
              p(class: "mt-1 text-sm text-muted-foreground") { status_description }
            end
            span(class: "text-sm font-medium tabular-nums text-foreground") { @website_import.retryable? ? "Capture failed" : "#{@website_import.progress}%" }
          end
          div(class: "h-1.5 bg-muted") do
            div(class: "h-full bg-primary transition-all", style: "width: #{@website_import.progress}%")
          end
          dl(class: "grid gap-px bg-border sm:grid-cols-3") do
            metric("Captured routes", @website_import.captured_pages)
            metric("Mapped pages", @website_import.mapped_pages)
            metric("Pages created", @website_import.imported_page_ids.size)
          end
          if @website_import.error_message.present? || @website_import.empty_capture?
            div(class: "border-t border-danger/30 bg-danger/10 px-5 py-4") do
              h3(class: "text-sm font-medium text-danger") { "Import failed" }
              pre(class: "mt-2 whitespace-pre-wrap break-words text-xs text-danger") { @website_import.error_message.presence || "No pages were captured or mapped. This earlier capture was incorrectly marked ready. Retry the capture to get a fresh result and its route-level diagnostics." }
            end
          end
        end

        if @website_import.ready?
          div(class: "mt-6 rounded-xl border border-success/30 bg-success/5 p-5") do
            h2(class: "text-sm font-semibold text-foreground") { "Next: create your editable pages" }
            p(class: "mt-1 text-sm text-muted-foreground") { "Capture is complete, but pages have not been created yet. Import the #{@website_import.mapped_pages} mapped pages as drafts, then review and publish them when ready. Your live site stays unchanged." }
            div(class: "mt-4") do
              render ButtonTo.new("Import #{@website_import.mapped_pages} editable pages", href: admin_website_import_application_path(@website_import), method: :post, variant: :primary, icon: :download)
            end
          end
        end
        import_review
        removal_controls
      end
    end

    private

    def removal_controls
      section(class: "mt-8 border-t border-border pt-6") do
        h2(class: "text-sm font-semibold") { "Remove imported site" }
        if @website_import.active?
          p(class: "mt-2 text-sm text-muted-foreground") { "Wait for this capture or import to finish before removing it." }
          return
        end
        count = @website_import.imported_pages.where.not(status: "trashed").count
        p(class: "mt-2 text-sm text-muted-foreground") { "Remove the import record, or also move its #{count} linked pages to trash. Pages claimed by another import are kept. Assets are retained so pages can be restored." }
        div(class: "mt-4 flex flex-wrap gap-3") do
          render ButtonTo.new("Remove import, keep pages", href: admin_website_import_path(@website_import), method: :delete, variant: :outline, size: :sm, data: { turbo_confirm: "Remove this import record? Its pages and assets will be kept." })
          if count.positive?
            render ButtonTo.new("Remove import & trash pages", href: admin_website_import_path(@website_import, disposition: "trash_pages"), method: :delete, variant: :danger, size: :sm, data: { turbo_confirm: "Remove this import and move #{count} linked pages to trash? You can restore the pages later." })
          end
        end
      end
    end

    def import_review
      report = @website_import.report || {}
      return if report["notices"].blank? && report["skippedRoutes"].blank? && report["quality"].blank? && report["failures"].blank?

      section(class: "mt-6 rounded-xl border border-border bg-background p-5") do
        h2(class: "text-sm font-semibold text-foreground") { "Import review" }
        failures = Array(report["failures"])
        if failures.any?
          h3(class: "mt-4 text-sm font-medium") { "#{failures.size} routes failed to capture" }
          failures.each do |failure|
            p(class: "mt-2 break-words text-xs text-muted-foreground") { "#{failure['url']}: #{failure['error']}" }
          end
        end
        recovered_behavior(report["quality"])
        Array(report["notices"]).each do |notice|
          p(class: "mt-2 text-sm text-muted-foreground") { notice }
        end
        skipped = Array(report["skippedRoutes"])
        if skipped.any?
          details(class: "mt-4") do
            summary(class: "cursor-pointer text-sm font-medium") { "#{skipped.size} linked URLs were not captured" }
            ul(class: "mt-3 space-y-3") do
              skipped.each do |entry|
                li(class: "break-words text-xs") do
                  span(class: "font-medium text-foreground") { entry["url"] }
                  p(class: "mt-1 text-muted-foreground") { entry["reason"] }
                end
              end
            end
          end
        end
      end
    end

    # Honest behaviour accounting: an import may look identical and still carry none of the
    # interactions. Report what actually became editable element data, not what the pixels imply.
    def recovered_behavior(quality)
      quality = quality.to_h
      return if quality.blank?

      metrics = [
        ["Native motion", quality["nativeMotionNodes"]],
        ["Motion groups", quality["motionGroups"]],
        ["Sticky layers", quality["stickyNodes"]],
        ["Interactions", quality["interactions"]],
        ["Component states", quality["statefulNodes"]],
        ["Sections with a role", quality["structuredSections"]],
      ]
      div(class: "mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3") do
        metrics.each { |label, value| metric(label, value || 0) }
      end
      p(class: "mt-3 text-xs text-muted-foreground") do
        "Appearance is preserved for every captured node; the counts above are the behavior that became editable element data. Controls the capture could not verify remain styled containers."
      end
    end

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
      return "Capture failed: no pages found" if @website_import.empty_capture?
      { "queued" => "Waiting to start", "capturing" => "Capturing the website", "mapping" => "Converting to native elements", "ready" => "Ready to import #{@website_import.mapped_pages} pages", "importing" => "Creating pages", "imported" => "Website imported", "failed" => "Capture stopped" }.fetch(@website_import.status)
    end

    def status_description
      return "This capture produced no pages and cannot be imported. Retry it to see the capture result." if @website_import.empty_capture?
      { "queued" => "The capture job is queued.", "capturing" => "Following authorized internal routes and recording responsive design evidence.", "mapping" => "Translating structure, styles, media, links, and motion into Builder data.", "ready" => "Capture finished. Choose Import editable pages to create the draft pages in Inkwell.", "importing" => "Creating editable pages and shared site parts.", "imported" => "The editable draft pages are available in Ink Builder.", "failed" => "No empty result is treated as a completed import. Review the capture error below, then retry." }.fetch(@website_import.status)
    end

    def status_color
      return :success if @website_import.status == "imported"
      return :destructive if @website_import.retryable?
      :neutral
    end
  end
end
