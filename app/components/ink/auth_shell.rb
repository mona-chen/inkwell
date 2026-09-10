module Ink
  class AuthShell < Component
    def initialize(title: nil, subtitle: nil, &block)
      @title = title
      @subtitle = subtitle
      @block = block
    end

    def view_template(&block)
      main(class: "ink-auth-shell bg-background text-foreground", data: { ink: "auth-shell", controller: "appearance" }) do
        div(class: "ink-auth-card bg-card border border-border", data: { ink: "card" }) do
          div(class: "ink-auth-brand") do
            span(class: "ink-auth-mark bg-primary text-primary-foreground") { render Ink::Icon.new(:pen_tool, size: :sm) }
            strong { "Inkwell" }
          end
          h1(class: "ink-auth-title") { @title } if @title
          p(class: "ink-auth-subtitle text-muted-foreground") { @subtitle } if @subtitle
          div(class: "ink-auth-form") { (@block || block)&.call }
        end
      end
    end
  end
end
