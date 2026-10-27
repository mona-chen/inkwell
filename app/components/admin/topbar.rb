module Admin
  class Topbar < ApplicationComponent
    include Phlex::Rails::Helpers::ButtonTo

    def initialize(title:, user:, current_site: nil)
      @title = title
      @user = user
      @current_site = current_site
    end

    def view_template
      div(class: "ink-topbar", data: { controller: "appearance" }) do
        div(class: "ink-topbar-context") do
          div(class: "ink-topbar-site") do
            if multisite_switcher_available?
              render Multisite::Admin::SiteSwitcher.new(current_site: @current_site, accessible_sites: multisite_sites, current_user: @user)
            else
              render Icon.new(:globe_2, size: :sm)
              span { @current_site&.name || "Workspace" }
            end
          end
          div(class: "ink-topbar-location") do
            render Icon.new(:chevron_right, size: :xs)
            span { @title }
          end
        end

        div(class: "ink-topbar-actions") do
          render_command_palette
          div(class: "ink-topbar-create") { render_create_menu }
          button(type: "button", class: "ink-topbar-icon ink-topbar-appearance", title: "Change appearance", data: { action: "click->appearance#toggle" }, aria: { label: "Toggle dark mode" }) do
            span(data: { theme_icon: "light" }) { render Icon.new(:moon, size: :sm) }
            span(class: "hidden", data: { theme_icon: "dark" }) { render Icon.new(:sun, size: :sm) }
          end
          a(href: "/", class: "ink-topbar-icon ink-topbar-visit", target: "_blank", rel: "noopener", title: "View site", aria: { label: "View site" }) { render Icon.new(:external_link, size: :sm) }
          div(class: "ink-topbar-account") do
            render Dropdown.new(placement: :bottom_end) do |menu|
              menu.trigger(variant: :ghost, size: :sm, label: "Account menu") do
                span(class: "ink-topbar-avatar", aria: { hidden: true }) do
                  (@user&.name.presence || "You").split.values_at(0, -1).uniq.map { |part| part.first }.join.upcase
                end
              end
              menu.title do
                div do
                  div(class: "text-sm font-medium") { @user&.name || "Admin" }
                  div(class: "text-xs text-muted-foreground") { @current_site&.name || "Inkwell" }
                end
              end
              menu.item("Settings", href: admin_settings_path, icon: :settings)
              menu.item("View site", href: "/", icon: :external_link)
              menu.separator
              menu.item("Sign out", href: destroy_user_session_path, icon: :log_out, variant: :destructive, data: { turbo_method: :delete })
            end
          end
        end
      end
    end

    private

    def multisite_sites
      return [] unless defined?(Multisite::UserSite)

      @multisite_sites ||= Array(@user.accessible_sites)
    end

    def multisite_switcher_available?
      defined?(Multisite::Admin::SiteSwitcher) && multisite_sites.size > 1
    rescue ActiveRecord::ActiveRecordError, NameError, NoMethodError
      false
    end

    def render_create_menu
      render Dropdown.new(placement: :bottom_end) do |menu|
        menu.trigger("New", variant: :outline, size: :sm, icon: :plus)
        menu.item("New post", href: new_admin_post_path, icon: :file_text)
        menu.item("New page", href: new_admin_page_path, icon: :layout)
        menu.separator
        menu.item("Upload media", href: admin_media_path, icon: :upload)
      end
    end

    def render_command_palette
      render CommandPalette.new(
        id: "admin-command-palette",
        compact: true,
        label: "Search or jump to…",
        placeholder: "Search pages, content, and settings…"
      ) do |palette|
        command_destinations.each do |dest|
          palette.destination(dest.fetch(:label), href: dest.fetch(:href), description: dest.fetch(:description))
        end
      end
    end

    def command_destinations
      [
        { label: "Overview", href: admin_root_path, description: "Site overview and recent activity" },
        { label: "Posts", href: admin_posts_path, description: "Write and manage posts" },
        { label: "Pages", href: admin_pages_path, description: "Design and publish pages" },
        { label: "Media", href: admin_media_path, description: "Browse the media library" },
        { label: "Comments", href: admin_comments_path, description: "Review conversations" },
        { label: "Site design", href: admin_design_path, description: "Themes and visual identity" },
        { label: "Navigation", href: admin_menus_path, description: "Menus and site structure" },
        { label: "Plugins", href: admin_plugins_path, description: "Extend the platform" },
        { label: "Users", href: admin_users_path, description: "People and access" },
        { label: "Settings", href: admin_settings_path, description: "Site-wide configuration" }
      ]
    end
  end
end
