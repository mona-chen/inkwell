module Admin
  class Topbar < ApplicationComponent
    def initialize(title:, user:, current_site: nil)
      @title = title
      @user = user
      @current_site = current_site
    end

    def view_template
      div(class: "flex h-full min-w-0 flex-1 items-center gap-3 sm:gap-5", data: { controller: "appearance" }) do
        div(class: "hidden min-w-28 lg:block") do
          div(class: "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground") { "Workspace" }
          div(class: "mt-0.5 truncate text-sm font-semibold text-foreground") { @title }
        end

        render_command_palette

        div(class: "ml-auto flex shrink-0 items-center gap-1.5") do
          div(class: "hidden sm:block") { render_create_menu }

          button(
            type: "button",
            class: "inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            data: { action: "click->appearance#toggle" },
            aria: { label: "Toggle dark mode" }
          ) do
            span(data: { theme_icon: "light" }) { render Icon.new(:moon, size: :sm) }
            span(class: "hidden", data: { theme_icon: "dark" }) { render Icon.new(:sun, size: :sm) }
          end

          a(
            href: "/",
            class: "hidden h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex",
            target: "_blank"
          ) do
            span(class: "hidden sm:inline") { "View site" }
            render Icon.new(:external_link, size: :xs)
          end

          div(class: "mx-1 hidden h-5 w-px bg-border sm:block") {}

          render Dropdown.new(placement: :bottom_end) do |menu|
            menu.trigger(variant: :ghost, size: :sm, label: "Account menu") do
              div(class: "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground") do
                (@user&.name || "A").first.upcase
              end
              span(class: "hidden md:inline text-sm font-medium") { @user&.name || "Admin" }
              render Icon.new(:chevron_down, size: :xs)
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
            menu.item("Sign out", href: "/users/sign_out", icon: :log_out, variant: :destructive, data: { turbo_method: :delete })
          end
        end
      end
    end

    private

    def render_create_menu
      render Dropdown.new(placement: :bottom_end) do |menu|
        menu.trigger("New", variant: :primary, size: :sm, icon: :plus)
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
        command_destinations.each do |dest|
          palette.destination(dest.fetch(:label), href: dest.fetch(:href), description: dest.fetch(:description))
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
