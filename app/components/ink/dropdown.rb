module Ink
  class Dropdown < Component
    def initialize(placement: :bottom_end, **html)
      @placement = placement
      @html = html
      @trigger_block = nil
      @trigger_text = nil
      @trigger_options = {}
      @items = []
    end

    def trigger(text = nil, **options, &block)
      @trigger_options = options
      if block
        @trigger_block = block
      else
        @trigger_text = text
      end
    end

    def item(text, href: nil, icon: nil, variant: nil, data: {}, **html)
      @items << { type: :item, text: text, href: href, icon: icon, variant: variant, data: data, html: html }
    end

    def title(&block)
      @title_block = block
    end

    def separator
      @items << { type: :separator }
    end

    def view_template
      yield self if block_given?

      div(class: "relative inline-flex", data: { controller: "dropdown", action: "keydown.esc@window->dropdown#close" }, **@html) do
        render_trigger
        render_menu
      end
    end

    private

    def render_trigger
      if @trigger_block
        button(
          type: "button",
          class: trigger_classes,
          data: { action: "click->dropdown#toggle" },
          aria: { label: @trigger_options[:label], expanded: "false", haspopup: "menu" }
        ) do
          @trigger_block.call
        end
      else
        button(
          type: "button",
          class: trigger_classes,
          data: { action: "click->dropdown#toggle" },
          aria: { label: @trigger_options[:label], expanded: "false", haspopup: "menu" }
        ) do
          render Ink::Icon.new(@trigger_options[:icon], size: @trigger_options[:size] == :xs ? :xs : :sm) if @trigger_options[:icon]
          span { @trigger_text } if @trigger_text
          render Ink::Icon.new(:chevron_down, size: :xs) unless @trigger_options[:icon] == :chevron_down
        end
      end
    end

    def trigger_classes
      base = "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50"
      variant = case @trigger_options[:variant]
      when :primary then "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
      when :outline then "border border-border bg-card hover:bg-muted"
      else "text-muted-foreground hover:bg-muted hover:text-foreground"
      end
      size = @trigger_options[:size] == :sm ? "h-9 px-3 text-sm" : "h-10 px-3.5 text-sm"
      "#{base} #{variant} #{size}"
    end

    def render_menu
      div(
        class: "absolute right-0 top-full z-50 mt-2 hidden min-w-52 overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl shadow-black/10",
        data: { dropdown_target: "menu" },
        role: "menu"
      ) do
        if @title_block
          div(class: "border-b border-border px-2.5 py-2.5 mb-1") { render @title_block }
        end
        @items.each do |item|
          if item[:type] == :separator
            div(class: "-mx-1 my-1 h-px bg-border")
          else
            data_attrs = { **(item[:data] || {}) }
            data_attrs[:variant] = item[:variant] if item[:variant]
            item_class = "relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground"
            item_class += " text-destructive hover:text-destructive" if item[:variant] == :destructive
            attrs = { class: item_class, data: data_attrs }
            attrs[:href] = item[:href] if item[:href]
            if item[:href]
              a(**attrs) do
                render Ink::Icon.new(item[:icon], size: :xs) if item[:icon]
                span { item[:text] }
              end
            else
              button(type: "button", **attrs) do
                render Ink::Icon.new(item[:icon], size: :xs) if item[:icon]
                span { item[:text] }
              end
            end
          end
        end
      end
    end
  end
end
