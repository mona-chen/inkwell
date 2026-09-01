module Ink
  class Card < Component
    def initialize(&block)
      @title = nil
      @body = nil
      @footer = nil
      @block = block
    end

    def title(text = nil, &block)
      @title_text = text
      @title_block = block
    end
    def body(&block) = (@body = block)
    def footer(&block) = (@footer = block)

    def view_template(&block)
      (@block || block)&.call(self)
      div(class: "flex min-w-0 flex-col rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs") do
        if @title_text || @title_block
          div(class: "border-b border-border/70 px-4 py-3") do
            @title_block ? @title_block.call : div(class: "text-sm font-semibold") { plain(@title_text.to_s) }
          end
        end
        div(class: "min-w-0 px-4 py-4") { @body&.call }
        if @footer
          div(class: "flex items-center border-t border-border/70 px-4 py-3") { @footer.call }
        end
      end
    end
  end
end
