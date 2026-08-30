module Admin
  class WebsiteImportForm < ApplicationComponent
    FORM_ID = "website-import-form"

    def initialize(website_import:)
      @website_import = website_import
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          div(class: "flex items-center gap-2") do
            render Button.new(href: admin_website_imports_path, variant: :ghost, size: :sm, icon: :arrow_left, aria: { label: "Back to website imports" })
            render ToolbarTitle.new(title: "Import a website", subtitle: "Capture and convert an authorized site into editable pages")
          end
        end
        toolbar.trailing do
          render Button.new("Start capture", type: :submit, form: FORM_ID, variant: :primary, icon: :globe, data: { turbo_submits_with: "Starting…" })
        end
      end

      render SettingsSection.new(
        title: "Website source",
        description: "Inkwell follows internal links, captures responsive evidence, then maps the site into native Builder elements."
      ) do |section|
        section.form do
          form_with(model: @website_import, url: admin_website_imports_path, id: FORM_ID, builder: NitroKit::FormBuilder) do |form|
            form.group do
              form.field(:source_url, as: :url, label: "Website URL", placeholder: "https://example.com", required: true, autofocus: true)
              form.field(:max_pages, as: :number, label: "Maximum pages", min: 1, max: 250, required: true)
              form.field(:max_depth, as: :number, label: "Link depth", min: 0, max: 12, required: true)
              form.field(
                :ownership_confirmed,
                as: :checkbox,
                label: "I own this website or have permission to reproduce and import it.",
                required: true
              )
            end
          end
        end
      end

      div(class: "mt-6 grid gap-4 md:grid-cols-3") do
        feature(:scan, "Multi-page discovery", "Internal routes, responsive layouts, assets, and source evidence are captured together.")
        feature(:panels_top_left, "Native conversion", "Sections become editable Builder elements instead of an iframe or opaque HTML block.")
        feature(:shield_check, "Safe publication", "The original capture stays separate while you refine and publish the native version.")
      end
    end

    private

    def feature(icon, title, copy)
      div(class: "rounded-xl border border-border bg-background p-4") do
        span(class: "mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary") { render Icon.new(icon, size: :sm) }
        h2(class: "text-sm font-medium text-foreground") { title }
        p(class: "mt-1 text-xs leading-relaxed text-muted-foreground") { copy }
      end
    end
  end
end
