module Admin
  # The authenticated admin frame. Navigation data stays application-owned while
  # the Ink shell owns the responsive chrome and focus boundaries.
  class Shell < ApplicationComponent
    ICONS = {
      "home" => :home,
      "document-text" => :file_text,
      "document" => :file,
      "photo" => :image,
      "chat-bubble-left" => :message_circle,
      "bars-3" => :menu,
      "paint-brush" => :palette,
      "palette" => :palette,
      "puzzle-piece" => :puzzle,
      "cog-6-tooth" => :settings,
      "envelope" => :mail,
      "at-symbol" => :at_sign,
      "users" => :users,
      "magnifying-glass" => :search,
      "layout" => :layout_dashboard,
      "globe" => :globe_2,
      "blocks" => :blocks,
      "code" => :code,
      "webhook" => :webhook,
      "default" => :circle
    }.freeze

    # Sidebar structure. An item may be a leaf (path + icon) or a parent with `children`.
    # Plugins contribute items/children via Inkwell::Plugin#register_admin_nav.
    GROUPS = [
      {
        label: "Publish",
        items: [
          { label: "Posts", path: "/admin/posts", icon: "document-text" },
          { label: "Pages", path: "/admin/pages", icon: "document" },
          { label: "Media", path: "/admin/media", icon: "photo" },
          { label: "Comments", path: "/admin/comments", icon: "chat-bubble-left" }
        ]
      },
      {
        label: "Site",
        items: [
          {
            label: "Appearance",
            icon: "paint-brush",
            children: [
              { label: "Themes", path: "/admin/themes", icon: "palette" },
              { label: "Content templates", path: "/admin/templates", icon: "layout" }
            ]
          },
          { label: "Navigation", path: "/admin/menus", icon: "bars-3" },
          { label: "Widgets", path: "/admin/widgets", icon: "blocks" },
          { label: "Import website", path: "/admin/website_imports", icon: "globe" }
        ]
      },
      {
        label: "Extensions",
        items: [
          { label: "Plugins", path: "/admin/plugins", icon: "puzzle-piece" }
        ]
      },
      {
        label: "Workspace",
        items: [
          { label: "Users", path: "/admin/users", icon: "users" },
          { label: "Settings", path: "/admin/settings", icon: "cog-6-tooth" }
        ]
      },
      {
        label: "Help",
        items: [
          { label: "Documentation", path: "/docs", icon: "document" },
          { label: "API reference", path: "/docs/api", icon: "code" }
        ]
      }
    ].freeze

    # Builds the sidebar groups (owned by the app, extended by plugins). Shared by
    # Admin::Layout (the live admin shell) and Admin::Shell.
    #
    # Plugin items merge into their target section; with `parent:` they attach beneath an
    # existing item (e.g. Appearance), and `children:` nests further items.
    def self.build_nav_groups(user:, pending_count: 0)
      groups = GROUPS.filter_map do |group|
        items = group[:items].filter_map { |item| build_nav_item(item, user: user, pending_count: pending_count) }
        [ group[:label], items ] if items.any?
      end

      Inkwell::PluginManager.admin_nav_items.each do |nav|
        item = build_nav_item(nav, user: user, pending_count: pending_count)
        next unless item

        section = (nav[:section] || "Extensions").to_s
        target = groups.find { |label, _items| label == section }
        target ||= (groups << [ section, [] ]).last

        if nav[:parent].present? && (parent = find_nav_item(target[1], nav[:parent].to_s))
          (parent[:children] ||= []) << item
        else
          target[1] << item
        end
      end

      groups
    end

    def self.build_nav_item(item, user:, pending_count: 0)
      return nil if item[:admin_only] && !user&.admin?

      children = Array(item[:children]).filter_map { |child| build_nav_item(child, user: user, pending_count: pending_count) }
      badge = item[:label] == "Comments" && pending_count.to_i.positive? ? pending_count : nil
      {
        label: item[:label],
        path: item[:path],
        icon: ICONS[item[:icon].to_s] || :circle,
        badge: badge,
        children: children.presence
      }.compact
    end

    def self.find_nav_item(items, label)
      items.each do |item|
        return item if item[:label] == label

        found = find_nav_item(Array(item[:children]), label)
        return found if found
      end
      nil
    end

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
          stylesheet_link_tag "ink", "data-turbo-track": "reload"
          stylesheet_link_tag "tailwind", "data-turbo-track": "reload"
          stylesheet_link_tag "application", "data-turbo-track": "reload"
          javascript_importmap_tags
        end
        body do
          render_flash
          render Ink::Shell.new do |shell|
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
      render Ink::Flash.new(flash)
    end

    def build_nav_groups
      self.class.build_nav_groups(user: @user, pending_count: Comment.pending.count)
    end
  end
end
