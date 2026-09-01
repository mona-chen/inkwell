module Admin
  class Layout < ApplicationComponent
    def initialize(title: "Home", user: nil, current_site: nil)
      @title = title
      @user = user || (defined?(current_user) ? current_user : nil)
      @current_site = current_site || (defined?(Current) ? Current.site : nil)
    end

    def view_template
      html lang: "en", data: { theme: "light" } do
        head do
          meta charset: "utf-8"
          meta name: "viewport", content: "width=device-width,initial-scale=1"
          title { "#{@title} — Inkwell" }
          csrf_meta_tags
          csp_meta_tag
          stylesheet_link_tag "ink", "data-turbo-track": "reload"
          stylesheet_link_tag "tailwind", "data-turbo-track": "reload"
          stylesheet_link_tag "application", "data-turbo-track": "reload"
          javascript_importmap_tags
        end
        body do
          render Ink::Flash.new(flash) if respond_to?(:flash)
          render Ink::Shell.new do |shell|
            shell.navigation do
              render Navigation.new(groups: nav_groups, user: @user, current_site: @current_site)
            end
            shell.topbar do
              render Topbar.new(title: @title, user: @user, current_site: @current_site)
            end
            shell.main do
              yield
            end
          end
        end
      end
    end

    private

    def nav_groups
      pending_count = Comment.pending.count
      groups = Admin::Shell::GROUPS.map do |group|
        items = group[:items].map do |item|
          badge = item[:label] == "Comments" && pending_count.positive? ? pending_count : nil
          item.merge(icon: Admin::Shell::ICONS[item[:icon]] || :circle, badge: badge)
        end
        [group[:label], items]
      end
      plugin_items = Inkwell::PluginManager.admin_nav_items.map do |item|
        { label: item[:label], path: item[:path], icon: Admin::Shell::ICONS[item[:icon].to_s] || :circle }
      end
      groups << ["Installed", plugin_items] if plugin_items.any?
      groups
    end
  end
end
