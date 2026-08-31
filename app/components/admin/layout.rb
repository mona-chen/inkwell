module Admin
  # Full HTML document for the admin area. Composes the Nitro AppShell around the
  # page content (passed as a block) and loads the Nitro Kit + app stylesheets.
  # Rendered from the ERB admin layout so existing page ERB can keep yielding here.
  class Layout < ApplicationComponent
    # Default accent colors for light and dark modes
    ACCENT_DEFAULTS = {
      light: "oklch(0.637 0.22 25)",   # warm coral/red
      dark:  "oklch(0.7 0.2 25)"
    }.freeze

    def initialize(title: "Home", user: nil, current_site: nil)
      @title = title
      @user = user || (defined?(current_user) ? current_user : nil)
      @current_site = current_site || (defined?(Current) ? Current.site : nil)
    end

    def view_template
      html lang: "en" do
        head do
          meta charset: "utf-8"
          meta name: "viewport", content: "width=device-width,initial-scale=1"
          title { "#{@title} — Inkwell" }
          csrf_meta_tags
          csp_meta_tag
          render NitroKit::AppearanceBootstrap.new(default: :light)
          stylesheet_link_tag "nitro_kit-tailwind-v4", "data-turbo-track": "reload"
          stylesheet_link_tag "nitro_kit", "data-turbo-track": "reload"
          stylesheet_link_tag "nitro_theme", "data-turbo-track": "reload"
          stylesheet_link_tag "tailwind", "data-turbo-track": "reload"
          stylesheet_link_tag "application", "data-turbo-track": "reload"
          javascript_importmap_tags
          # Inject site-configurable accent color as CSS custom properties
          if accent_css.present?
            style { raw(safe(accent_css)) }
          end
          # Inject plugin-specific admin CSS
          plugin_css_tags = Inkwell::Hooks.filter(:admin_stylesheet_tags, [])
          Array(plugin_css_tags).each { |css| style { raw(safe(css.to_s)) } }
        end
        body do
          render_flash
          render NitroKit::AppShell.new(id: "admin-shell", layout: :hybrid) do |shell|
            shell.navigation do
              render Navigation.new(
                groups: nav_groups,
                user: @user,
                current_site: @current_site
              )
            end
            shell.topbar do
              render Topbar.new(title: @title, user: @user, current_site: @current_site)
            end
            shell.main do
              div(class: "admin-workspace") { yield }
            end
          end
        end
      end
    end

    private

    def render_flash
      return unless respond_to?(:flash) && flash.any?
      render NitroKit::Toast::FlashMessages.new(flash)
    end

    # Read the configured accent color from site settings, falling back to defaults.
    # The value is an oklch() string. Injected as a CSS custom property on #admin-shell
    # so the entire admin theme responds to the site's chosen accent.
    def accent_css
      accent = @current_site&.setting("accent_color")
      return "" if accent.blank?

      light = ACCENT_DEFAULTS[:light]
      dark  = ACCENT_DEFAULTS[:dark]

      # If the user set a single color, use it for both modes.
      # If they set a hash { light: ..., dark: ... }, use each.
      if accent.is_a?(Hash)
        light = accent["light"] || light
        dark  = accent["dark"]  || dark
      else
        light = accent
        dark  = accent
      end

      <<~CSS.squish
        --nk-color-primary: #{light};
        --nk-color-primary-hover: #{light};
        --nk-color-focus: #{light};
        [data-theme="dark"] &, :root:not([data-theme]) & {
          --nk-color-primary: #{dark};
          --nk-color-primary-hover: #{dark};
          --nk-color-focus: #{dark};
        }
      CSS
    end

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
