module Ink
  class DataSection < Component
    def initialize(title: nil, **html, &block)
      @title = title
      @html = html
      @empty_state = nil
      @table = nil
      @table_block = nil
      @block = block
    end

    def empty_state(component) = (@empty_state = component)
    def table(component, &block) = (@table = component; @table_block = block)

    def view_template(&block)
      config = @block || block
      config&.call(self) if config&.arity == 1
      section(class: "overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs", **@html) do
        if @title
          h2(class: "px-4 py-2.5 text-sm font-semibold border-b border-border") { @title }
        end
        if @empty_state
          render @empty_state
        elsif @table
          render @table, &@table_block
        else
          config&.call if config&.arity != 1
        end
      end
    end
  end
end
