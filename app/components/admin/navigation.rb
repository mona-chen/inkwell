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
          div(class: "admin-brand flex items-center gap-2 px-4 py-3") do
            span(class: "admin-brand-mark") { "I" }
            span(class: "min-w-0") do
              strong(class: "block text-sm font-semibold tracking-tight") { "Inkwell" }
              span(class: "block text-[10px] font-medium uppercase tracking-[0.14em] opacity-50") { "Studio" }
            end
          end
        end
        nav.body do
          nav.item("Home", href: "/admin", icon: :home, current: current?("/admin"))
          @groups.each do |(label, items)|
            nav.section(label: label) do
              items.each { |item| nav_item(nav, item) }
            end
          end
          nav.spacer
        end
        nav.footer do
          # Footer is empty — profile moved to topbar
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
