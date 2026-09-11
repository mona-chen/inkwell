module Admin
  class Navigation < ApplicationComponent
    def initialize(groups:, user:, current_site: nil)
      @groups = groups
      @user = user
      @current_site = current_site
    end

    def view_template
      render Ink::Navigation.new(
        groups: nav_items,
        brand_title: "Inkwell",
        brand_sub: "Studio",
        footer: -> { render_user_footer }
      )
    end

    private

    def nav_items
      [{ label: nil, items: [{ label: "Home", path: "/admin", icon: :home, current: current?("/admin") }] }] +
        @groups.map do |(label, items)|
          { label: label, items: items.map { |item| nav_item(item) } }
        end
    end

    def nav_item(item)
      children = Array(item[:children]).map { |child| nav_item(child) }
      path = item[:path]
      current = path.present? && current?(path)
      current ||= children.any? { |child| child[:current] } if children.any?

      attrs = { label: item[:label], path: path, icon: item[:icon], current: current }
      attrs[:badge] = item[:badge] if item[:badge]
      attrs[:children] = children if children.any?
      attrs
    end

    def render_user_footer
      div(class: "flex items-center gap-3") do
        div(class: "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold") do
          (@user&.name.presence || "You").split.values_at(0, -1).uniq.map { |part| part.first }.join.upcase
        end
        div(class: "min-w-0 flex-1") do
          div(class: "truncate text-xs font-semibold text-sidebar-foreground") { @user&.name || "Admin" }
          div(class: "mt-0.5 truncate text-[11px] text-sidebar-foreground/42") { @current_site&.name || "Inkwell" }
        end
      end
    end

    def current?(path)
      return current_path == path if path == "/admin"
      current_path == path || current_path.start_with?("#{path}/")
    end

    def current_path
      helpers.request.path
    end
  end
end
