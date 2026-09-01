module Ink
  class Grid < Component
    def initialize(cols: "1", gap: 4, **html, &block)
      @cols = cols
      @gap = gap
      @html = html
      @block = block
    end

    def view_template(&block)
      div(class: grid_classes, **@html) { (@block || block)&.call }
    end

    private

    def grid_classes
      parts = @cols.to_s.split
      classes = ["grid"]
      parts.each do |part|
        if part.include?(":")
          bp, n = part.split(":")
          classes << "#{bp}:grid-cols-#{n}"
        else
          classes << "grid-cols-#{part}"
        end
      end
      classes << "gap-#{@gap}" if @gap
      classes.join(" ")
    end
  end
end
