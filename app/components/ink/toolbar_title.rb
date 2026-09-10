module Ink
  class ToolbarTitle < Component
    def initialize(title:, subtitle: nil)
      @title = title
      @subtitle = subtitle
    end

    def view_template
      div(class: "min-w-0") do
        h1(class: "text-xl font-semibold tracking-[-0.035em] text-foreground") { @title }
        if @subtitle
          p(class: "mt-0.5 text-xs leading-5 text-muted-foreground") { @subtitle }
        end
      end
    end
  end
end
