module Admin
  # Nitro AppNavigation composed from application-owned nav groups + the current user's
  # brand/footer. The active item is computed from the request path.
  class Navigation < ApplicationComponent
    def initialize(groups:, user:, current_site: nil)
      @groups = groups
      @user = user
      @current_site = current_site
    end

    def view_template
      render NitroKit::AppNavigation.new(label: "Admin navigation") do |nav|
        nav.header do
          div(class: "flex items-center gap-2 px-4 py-3") do
            strong(class: "text-lg font-bold tracking-tight") { "Inkwell" }
          end
        end
        nav.body do
          nav.item("Dashboard", href: "/admin", icon: :layout_dashboard, current: current?("/admin"))
          @groups.each do |(label, items)|
            nav.section(label: label) do
              items.each { |item| nav_item(nav, item) }
            end
          end
          nav.spacer
        end
        nav.footer do
          div(class: "px-4 py-3") do
            div(class: "flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5") do
              span(
                class: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              ) do
                (@user&.name || "A").first.upcase
              end
              div(class: "min-w-0 flex-1") do
                div(class: "truncate text-sm font-medium text-foreground") { @user&.name || "Admin" }
                div(class: "truncate text-xs text-muted-foreground") { @current_site&.name || "Inkwell" }
              end
            end
            div(class: "mt-2 flex items-center justify-end px-1") do
              a(
                href: "/users/sign_out",
                data: { turbo_method: :delete },
                class: "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
              ) do
                "Sign out"
              end
            end
          end
        end
      end
    end

    private

    def nav_item(nav, item)
      attrs = { href: item[:path], icon: item[:icon], current: current?(item[:path]) }
      if item[:badge]
        attrs[:badge] = item[:badge]
        attrs[:badge_color] = :warning
      end
      nav.item(item[:label], **attrs)
    end

    # Match the nav item's section: exact path, or any subpath beneath it. e.g. /admin/posts/123
    # highlights "Posts" (its path is /admin/posts). "/admin" (dashboard) only matches exactly.
    def current?(path)
      return current_path == path if path == "/admin"
      current_path == path || current_path.start_with?("#{path}/")
    end

    def current_path
      helpers.request.path
    end
  end
end
