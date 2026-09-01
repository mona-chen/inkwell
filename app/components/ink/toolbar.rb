module Ink
  class Toolbar < Component
    def initialize(&block)
      @leading = nil
      @trailing = nil
      @block = block
    end

    def leading(&block) = (@leading = block)
    def trailing(&block) = (@trailing = block)

    def view_template(&block)
      (@block || block)&.call(self)
      div(class: "mb-5 flex min-h-10 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between") do
        div(class: "min-w-0") { @leading&.call }
        div(class: "flex shrink-0 flex-wrap items-center gap-2") { @trailing&.call }
      end
    end
  end
end
