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
          Array(Inkwell::Hooks.filter(:admin_stylesheet_tags, [])).each do |css|
            style { raw(safe(css.to_s)) }
          end
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
      Admin::Shell.build_nav_groups(user: @user, pending_count: Comment.pending.count)
    end
  end
end
