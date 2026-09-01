module Ink
  class EmptyState < Component
    def initialize(title:, description: nil, icon: :inbox, level: 3, variant: nil, &block)
      @title = title
      @description = description
      @icon = icon
      @level = level
      @variant = variant
      @action = nil
      @block = block
    end

    def action(component) = (@action = component)

    def view_template(&block)
      (@block || block)&.call(self)
      container = @variant == :borderless ? "flex flex-col items-center text-center py-8 px-4" : "flex flex-col items-center text-center py-9 px-4 rounded-xl bg-card ring-1 ring-border/70"
      div(class: container) do
        div(class: "mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-muted/60 text-muted-foreground") do
          render Ink::Icon.new(@icon, size: :sm)
        end
        send(:"h#{@level}", class: "text-sm font-semibold") { @title }
        if @description
          p(class: "mt-1 text-xs text-muted-foreground max-w-sm") { @description }
        end
        if @action
          div(class: "mt-4") { render @action }
        end
      end
    end
  end
end
