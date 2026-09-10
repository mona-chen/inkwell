module Ink
  class SettingsLayout < Component
    def initialize(id: nil, **html)
      @id = id
      @html = html
      @nav_block = nil
      @content_block = nil
    end

    def navigation(label: nil, &block)
      @nav_label = label
      @nav_block = block
    end

    def content(&block) = (@content_block = block)

    def view_template(&block)
      block&.call(self)
      div(id: @id, class: "grid min-w-0 gap-6 lg:grid-cols-[12.5rem_minmax(0,1fr)]", **@html) do
        aside(class: "self-start lg:sticky lg:top-4") do
          navigation = SettingsNavigation.new(label: @nav_label)
          @nav_block&.call(navigation)
          render navigation
        end
        div(class: "min-w-0") { @content_block&.call }
      end
    end
  end

  class SettingsNavigation < Component
    def initialize(label: nil, &block)
      @label = label
      @items = []
      @block = block
    end

    def item(label, href:, icon: nil, current: false)
      @items << { label: label, href: href, icon: icon, current: current }
    end

    def view_template(&block)
      (@block || block)&.call(self)
      div(class: "flex flex-col gap-0.5 mb-2") do
        if @label
          div(class: "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2") { @label }
        end
        @items.each do |item|
          active = item[:current]
          a(
            href: item[:href],
            class: "flex h-8 items-center gap-2 rounded-lg px-2.5 text-xs font-medium transition-colors #{active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}"
          ) do
            render Ink::Icon.new(item[:icon], size: :sm) if item[:icon]
            span { item[:label] }
          end
        end
      end
    end
  end
end
