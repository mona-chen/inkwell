module Admin
  # Global command and account surface. Route titles belong to each page's Toolbar.
  class Topbar < ApplicationComponent
    def initialize(title:, user:, current_site: nil)
      @title = title
      @user = user
      @current_site = current_site
    end

    def view_template
      div(class: "admin-topbar-content flex items-center justify-between gap-4 w-full h-full", data: { controller: "appearance" }) do
        render_command_palette

        div(class: "flex items-center gap-3 text-sm") do
          render_create_menu

          # Dark mode toggle
          button(
            type: "button",
            class: "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            data: { action: "click->appearance#toggle" },
            aria: { label: "Toggle dark mode" }
          ) do
            render Icon.new(:sun, size: :sm)
          end

          a(
            href: "/",
            class: "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          ) do
            span(class: "hidden sm:inline") { "View site" }
            render Icon.new(:external_link, size: :sm)
          end

          div(class: "h-5 w-px bg-border") {}

          render Dropdown.new(placement: :bottom_end) do |menu|
            menu.trigger(variant: :ghost, size: :sm, label: "Account menu") do
              span(
                class: "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              ) do
                (@user&.name || "A").first.upcase
              end
              span(class: "hidden md:inline text-sm font-medium text-foreground") { @user&.name || "Admin" }
              render Icon.new(:chevron_down, size: :xs)
            end
            menu.title do
              div do
                div(class: "text-sm font-medium text-foreground") { @user&.name || "Admin" }
                div(class: "text-xs text-muted-foreground") { @current_site&.name || "Inkwell" }
              end
            end
            menu.item("Settings", href: admin_settings_path, icon: :settings)
            menu.item("View site", href: "/", icon: :external_link)
            menu.separator
            menu.item("Sign out", href: "/users/sign_out", icon: :log_out, variant: :destructive, data: { turbo_method: :delete })
          end
        end
      end
    end

    private

    def render_create_menu
      render Dropdown.new(placement: :bottom_end) do |menu|
        menu.trigger("Create", variant: :primary, size: :sm, icon: :plus)
        menu.item("New post", href: new_admin_post_path, icon: :file_text)
        menu.item("New page", href: new_admin_page_path, icon: :layout)
        menu.separator
        menu.item("Upload media", href: admin_media_path, icon: :upload)
      end
    end

    def render_command_palette
      render CommandPalette.new(
        id: "admin-command-palette",
        label: "Search or jump to…",
        placeholder: "Search pages, content, and settings…"
      ) do |palette|
        command_destinations.each do |destination|
          palette.destination(
            destination.fetch(:label),
            href: destination.fetch(:href),
            description: destination.fetch(:description)
          )
        end
      end
    end

    def command_destinations
      [
        { label: "Dashboard", href: admin_root_path, description: "Site overview and recent activity" },
        { label: "Posts", href: admin_posts_path, description: "Write and manage posts" },
        { label: "Pages", href: admin_pages_path, description: "Design and publish pages" },
        { label: "Media", href: admin_media_path, description: "Browse the media library" },
        { label: "Comments", href: admin_comments_path, description: "Review conversations" },
        { label: "Appearance", href: admin_themes_path, description: "Themes and visual identity" },
        { label: "Navigation", href: admin_menus_path, description: "Menus and site structure" },
        { label: "Plugins", href: admin_plugins_path, description: "Extend the platform" },
        { label: "Users", href: admin_users_path, description: "People and access" },
        { label: "Settings", href: admin_settings_path, description: "Site-wide configuration" }
      ]
    end
  end
end
