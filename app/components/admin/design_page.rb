module Admin
  class DesignPage < ApplicationComponent
    def initialize(site:, section:)
      @site, @section = site, section
    end

    def view_template
      render Toolbar.new do |bar|
        bar.leading { render ToolbarTitle.new(title: "Site design", subtitle: "Templates, shared parts, and your frontend theme.") }
        bar.trailing { render Button.new("View site", href: "/", variant: :outline, size: :sm, icon: :external_link) }
      end
      render DesignNavigation.new(current: @section)
      case @section
      when "parts" then render_parts
      when "styles" then render_styles
      else render_overview
      end
    end

    private

    def row(title, description, label, href)
      section(class: "design-row") do
        div do
          h2 { title }
          p { description }
        end
        render Button.new(label, href: href, variant: :outline, size: :sm, icon: :arrow_right)
      end
    end

    def render_overview
      row("Content templates", "Design the blog index, individual posts, archives, and author pages. Unpublished templates keep the current theme’s rendering.", "Manage templates", "/admin/templates")
      row("Header & footer", "Create shared parts in the visual Builder and assign them to pages.", "Manage parts", "/admin/design?section=parts")
      row("Styles", "Set inherited colors, typography, and spacing for native Builder pages.", "Style settings", "/admin/design?section=styles")
      row("Navigation", "Edit the links used by your site’s menus.", "Edit navigation", "/admin/menus")
      row("Theme packages", "Active theme: #{@site.active_theme}. Preview another frontend before activating it.", "Manage themes", "/admin/themes")
    end

    def render_parts
      div(class: "design-note") { "Shared parts are edited in the Builder’s Theme panel. Publishing updates the shared registry; each page must reference a part to use it. Existing saved page output may need republishing to reflect changes." }
      %w[header footer].each do |key|
        part = @site.builder_site_parts[key]
        section(class: "design-row") do
          div do
            h2 { key.capitalize }
            p { part.present? ? "Saved in the site’s shared-part registry." : "No shared #{key} has been created." }
          end
          div(class: "design-row-actions") do
            render Badge.new(part.present? ? "Available" : "Not created", color: :neutral, size: :xs)
            render ButtonTo.new(part.present? ? "Edit #{key}" : "Create #{key}", href: admin_edit_design_part_path(key), method: :post, variant: :outline, size: :sm)
          end
        end
      end
      render_page_links("Open a page to edit or insert its header and footer")
    end

    def render_styles
      div(class: "design-note") { "These defaults are inherited by native Builder pages that use site styles. Page and element overrides stay intact. Older saved pages need one Builder publish to adopt inheritance. Imported frontends keep their own CSS." }
      values = @site.builder_styles.values
      form_with(url: admin_design_path, method: :patch, scope: :styles) do |form|
        fieldset(class: "design-style-fields") do
          legend { "Colors" }
          SiteDesignStyles::COLORS.each_key do |key|
            div do
              form.label key, key.capitalize
              form.color_field key, value: values[key], class: "ink-control"
            end
          end
        end
        fieldset(class: "design-style-fields") do
          legend { "Typography & spacing" }
          div do
            form.label :font, "Font family"
            form.select :font, [["Sans serif", "sans"], ["Serif", "serif"], ["Monospace", "mono"]], { selected: values["font"] }, class: "ink-control"
          end
          SiteDesignStyles::NUMBERS.each do |key, (_fallback, range)|
            div do
              form.label key, key.underscore.humanize + (key == "lineHeight" ? "" : " (px)")
              form.number_field key, value: values[key], min: range.min, max: range.max, step: key == "lineHeight" ? 0.1 : 1, class: "ink-control"
            end
          end
        end
        render Button.new("Save site styles", type: :submit, variant: :primary, size: :sm)
      end
      render_page_links("Page overrides")
    end

    def render_page_links(title)
      h2(class: "mt-6 mb-2 text-sm font-semibold") { title }
      pages = @site.pages.where(template_for: nil).order(updated_at: :desc).limit(5)
      if pages.empty?
        render Button.new("Create a page", href: new_admin_page_path, variant: :primary, size: :sm)
      end
      pages.each do |page|
        row(page.title.presence || "Untitled page", "#{page.status.capitalize} · page styles and shared parts", "Open Builder", "/builder/page/#{page.id}?panel=site")
      end
      a(href: admin_pages_path, class: "mt-4 inline-block text-sm text-primary") { "All pages" } if pages.any?
    end
  end
end
