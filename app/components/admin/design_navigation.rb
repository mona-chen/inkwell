module Admin
  class DesignNavigation < ApplicationComponent
    def initialize(current:)
      @current = current
    end

    def view_template
      nav(class: "design-tabs", aria: { label: "Site design" }) do
        [ ["Overview", "/admin/design", "overview"], ["Templates", "/admin/templates", "templates"],
          ["Header & footer", "/admin/design?section=parts", "parts"], ["Styles", "/admin/design?section=styles", "styles"],
          ["Navigation", "/admin/menus", "navigation"], ["Widgets", "/admin/widgets", "widgets"],
          ["Theme packages", "/admin/themes", "themes"] ].each do |label, path, key|
          a(href: path, aria: @current == key ? { current: "page" } : {}) { label }
        end
      end
    end
  end
end
