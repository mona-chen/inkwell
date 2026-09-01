module Ink
  class DangerZone < Component
    def initialize(title:, description: nil, &block)
      @title = title
      @description = description
      @block = block
    end

    def view_template
      div(class: "border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4") do
        h3(class: "text-sm font-semibold text-red-700 dark:text-red-400 mb-1") { @title }
        p(class: "text-xs text-muted-foreground mb-3") { @description } if @description
        div(class: "flex gap-2") { @block&.call }
      end
    end
  end
end
