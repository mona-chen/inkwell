module Ink
  class AuthShell < Component
    def initialize(title: nil, subtitle: nil, &block)
      @title = title
      @subtitle = subtitle
      @block = block
    end

    def view_template
      div(class: "min-h-svh grid place-items-center bg-background p-6") do
        div(class: "w-full max-w-sm bg-card border border-border p-8 shadow-lg") do
          div(class: "flex items-center gap-2 mb-5") do
            span(class: "flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground text-sm font-bold") { "I" }
            strong(class: "text-sm font-semibold tracking-tight") { "Inkwell" }
          end
          h1(class: "text-lg font-semibold tracking-tight") { @title } if @title
          p(class: "mt-1 text-xs text-muted-foreground") { @subtitle } if @subtitle
          div(class: "mt-6") { @block&.call }
        end
      end
    end
  end
end
