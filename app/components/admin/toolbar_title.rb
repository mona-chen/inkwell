module Admin
  # Standard Toolbar.leading title block (title + optional subtitle). Keeps the route
  # heading consistent across every admin page; the shell Toolbar owns the single h1.
  class ToolbarTitle < ApplicationComponent
    def initialize(title:, subtitle: nil)
      @title = title
      @subtitle = subtitle
    end

    def view_template
      div do
        h1(class: "text-xl font-semibold tracking-tight text-foreground") { @title }
        if @subtitle
          p(class: "mt-0.5 text-sm text-muted-foreground") { @subtitle }
        end
      end
    end
  end
end
