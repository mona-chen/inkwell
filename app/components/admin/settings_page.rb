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
