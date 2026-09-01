module Ink
  class Flex < Component
    def initialize(dir: :col, gap: 4, wrap: nil, align: nil, justify: nil, **html, &block)
      @dir = dir
      @gap = gap
      @wrap = wrap
      @align = align
      @justify = justify
      @html = html
      @block = block
    end

    def view_template(&block)
      div(class: flex_classes, **@html) { (@block || block)&.call }
    end

    private

    def flex_classes
      classes = ["flex"]
      classes << "flex-#{@dir}" if @dir
      classes << "gap-#{@gap}" if @gap
      classes << "flex-wrap" if @wrap
      classes << "items-#{@align}" if @align
      classes << "justify-#{@justify}" if @justify
      classes.join(" ")
    end
  end
end
