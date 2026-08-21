module Admin
  # The authenticated admin frame: Nitro AppShell (sidebar layout) + AppNavigation.
  # Navigation data is application-owned (static groups + plugin nav items); the shell
  # owns chrome, mobile disclosure, and focus management.
  class Shell < ApplicationComponent
    ICONS = {
      "home" => :home,
      "document-text" => :file_text,
      "document" => :file,
      "photo" => :image,
      "chat-bubble-left" => :message_circle,
      "bars-3" => :menu,
      "paint-brush" => :palette,
      "puzzle-piece" => :puzzle,
      "cog-6-tooth" => :settings,
      "envelope" => :mail,
      "at-symbol" => :at_sign,
      "users" => :users,
      "magnifying-glass" => :search,
      "layout" => :layout_dashboard,
      "default" => :circle
    }.freeze

    GROUPS = [
      {
        label: "Content",
        items: [
          { label: "Posts", path: "/admin/posts", icon: "document-text" },
          { label: "Pages", path: "/admin/pages", icon: "document" },
          { label: "Media", path: "/admin/media", icon: "photo" },
          { label: "Comments", path: "/admin/comments", icon: "chat-bubble-left" },
          { label: "Categories", path: "/admin/taxonomies", icon: "bars-3" }
        ]
      },
      {
        label: "Design",
        items: [
          { label: "Themes", path: "/admin/themes", icon: "paint-brush" },
          { label: "Menus", path: "/admin/menus", icon: "bars-3" },
          { label: "Widgets", path: "/admin/widgets", icon: "layout" }
        ]
      },
      {
        label: "System",
        items: [
          { label: "Plugins", path: "/admin/plugins", icon: "puzzle-piece" },
          { label: "Users", path: "/admin/users", icon: "users" },
          { label: "Settings", path: "/admin/settings", icon: "cog-6-tooth" }
        ]
      }
    ].freeze

    def initialize(title:, user:, current_site:, content:)
      @title = title
      @user = user
      @current_site = current_site
      @content = content
      @nav_groups = build_nav_groups
    end

    def view_template
      html lang: "en", data: { theme: "light" } do
        head do
          meta charset: "utf-8"
          meta name: "viewport", content: "width=device-width,initial-scale=1"
          title { "#{@title} — Inkwell Admin" }
          csrf_meta_tags
          csp_meta_tag
          render NitroKit::AppearanceBootstrap.new(default: :light)
          stylesheet_link_tag "nitro_kit", "data-turbo-track": "reload"
          stylesheet_link_tag "tailwind", "data-turbo-track": "reload"
          stylesheet_link_tag "application", "data-turbo-track": "reload"
          javascript_importmap_tags
        end
        body do
          render_flash
          render AppShell.new(id: "admin-shell", layout: :sidebar) do |shell|
            shell.navigation do
              render Navigation.new(groups: @nav_groups, user: @user, current_site: @current_site)
            end
            shell.topbar do
              render Topbar.new(title: @title, user: @user, current_site: @current_site)
            end
            shell.main do
              div(class: "p-6") { plain @content }
            end
          end
        end
      end
    end

    private

    def render_flash
      return unless flash.any?
      render NitroKit::Toast::FlashMessages.new(flash)
    end

    def build_nav_groups
      groups = GROUPS.map do |group|
        items = group[:items].map { |item| item.merge(icon: ICONS[item[:icon]] || :circle) }
        [group[:label], items]
      end
      plugin_items = Inkwell::PluginManager.admin_nav_items.map do |item|
        { label: item[:label], path: item[:path], icon: ICONS[item[:icon].to_s] || :circle }
      end
      groups << ["Plugins", plugin_items] if plugin_items.any?
      groups
    end

    def current_path
      helpers.request.path
    end
  end
end
