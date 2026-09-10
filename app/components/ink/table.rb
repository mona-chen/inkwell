module Ink
  class Table < Component
    def initialize(**html, &block)
      @html = html
      @block = block
    end

    def thead(&block) = (@thead = block)
    def tbody(&block) = (@tbody = block)

    def view_template(&block)
      (@block || block)&.call(self)
      div(class: "overflow-x-auto", **@html) do
        table(class: "w-full text-[13px]") do
          thead(class: "bg-muted/45") { @thead&.call(self) }
          tbody(class: "divide-y divide-border/70") { @tbody&.call(self) }
        end
      end
    end

    def tr(**html, &block)
      content_tag(:tr, class: "hover:bg-muted/35 transition-colors", **html) do
        block.call(self)
      end
    end

    def th(content = nil, align: nil, &block)
      cls = "px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]"
      cls += " text-#{align}" if align
      content_tag(:th, class: cls) { block ? block.call : plain(content.to_s) }
    end

    def td(content = nil, align: nil, &block)
      cls = "px-3 py-2.5 text-[13px]"
      cls += " text-#{align}" if align
      content_tag(:td, class: cls) { block ? block.call : plain(content.to_s) }
    end

    private

    def content_tag(tag, **html, &block)
      send(tag, class: html.delete(:class), **html) { yield }
    end
  end
end
