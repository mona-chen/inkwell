# frozen_string_literal: true

module Admin
  # Site settings. Two SettingsSections: General (site identity) and Homepage (what the
  # front page shows — WordPress "Settings → Reading").
  class SettingsPage < ApplicationComponent
    def initialize(site:)
      @site = site
      @pages = site.pages.published.ordered
    end

    def view_template
      render Toolbar.new do |toolbar|
        toolbar.leading do
          render ToolbarTitle.new(title: "Settings", subtitle: "Site-wide configuration")
        end
      end

      render_general_section
      render_homepage_section
    end

    private

    def render_general_section
      render SettingsSection.new(title: "General", description: "Site-wide settings for #{@site.name}.") do |section|
        section.form do
          form_with(url: admin_settings_path, method: :patch, builder: NitroKit::FormBuilder) do |form|
            form.group do
              form.field(:site_title, value: setting_value("site_title"), label: "Site title")
              form.field(:tagline, value: setting_value("tagline"), label: "Tagline")
              form.field(:site_url, value: setting_value("site_url"), label: "Site URL")
              form.field(:timezone, value: setting_value("timezone"), label: "Timezone")
              form.field(:posts_per_page, value: setting_value("posts_per_page"), label: "Posts per page", as: :string)
            end

            form.group do
              render_logo_field
            end

            form.group do
              render NitroKit::Checkbox.new(
                label: "Enable comments",
                name: "settings[comments_enabled]",
                value: "1",
                unchecked_value: "0",
                checked: setting_value("comments_enabled") == "1" || setting_value("comments_enabled").nil?
              )
            end
            form.group do
              form.submit("Save settings")
            end
          end
        end
      end
    end

    def render_logo_field
      logo = @site.logo_item
      div(data: { controller: "media-picker" }) do
        div(class: "mb-1 block text-xs font-medium text-muted-foreground") { "Site logo" }
        div(class: "flex items-center gap-4") do
          div(
            data: { media_picker_target: "preview" },
            class: "flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
          ) do
            if logo
              img(src: logo.url, class: "h-full w-full object-contain", alt: "")
            else
              span(class: "text-xs text-muted-foreground") { "None" }
            end
          end
          div(class: "flex-1 space-y-2") do
            input(
              type: "text",
              name: "settings[site_logo]",
              value: setting_value("site_logo"),
              data: { media_picker_target: "urlField" },
              placeholder: "Logo media id, or pick below",
              class: "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            )
            button(
              type: "button",
              data: { action: "media-picker#open" },
              class: "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            ) do
              render Icon.new(:image, size: :sm)
              "Choose from media library"
            end
          end
        end

        render_logo_picker_dialog
      end
    end

    def render_logo_picker_dialog
      dialog(
        data: { media_picker_target: "dialog", action: "click->media-picker#backdropClose" },
        class: "m-auto w-[42rem] max-w-full rounded-2xl border border-border bg-background p-0 shadow-2xl backdrop:bg-black/40"
      ) do
        div do
          div(class: "flex items-center justify-between border-b border-border px-4 py-3") do
            h3(class: "text-sm font-semibold text-foreground") { "Choose a logo" }
            button(
              type: "button",
              data: { action: "media-picker#close" },
              aria: { label: "Close" },
              class: "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            ) { render Icon.new(:x, size: :sm) }
          end
          div(class: "max-h-[60vh] overflow-y-auto") do
            turbo_frame_tag(
              "settings-logo-picker-frame",
              data: { media_picker_target: "frame", src: admin_media_path(picker: 1, logo: 1) }
            ) do
              div(class: "p-4 text-center text-sm text-muted-foreground") { "Loading…" }
            end
          end
        end
      end
    end

    def render_homepage_section
      render SettingsSection.new(
        title: "Homepage",
        description: "Choose what visitors see at your site's front page."
      ) do |section|
        section.form do
          form_with(url: admin_settings_path, method: :patch, builder: NitroKit::FormBuilder) do |form|
            form.group do
              render NitroKit::RadioButtonGroup.new(
                legend: "Your homepage displays",
                name: "settings[show_on_front]",
                options: [
                  NitroKit::Choice.new(label: "Your latest posts", value: "posts"),
                  NitroKit::Choice.new(label: "A static page", value: "page")
                ],
                value: setting_value("show_on_front", "posts")
              )
            end
            form.group do
              form.field(
                :page_on_front,
                as: :select,
                label: "Homepage page",
                options: @pages.map { |p| [p.title, p.id.to_s] },
                include_blank: "Select a page…"
              )
            end
            form.group do
              form.submit("Save homepage")
            end
          end
        end
      end
    end

    def setting_value(key, default = nil)
      @site.setting(key, default)
    end
  end
end
