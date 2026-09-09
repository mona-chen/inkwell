module Ink
  class DangerZone < Component
    def initialize(title:, description: nil, &block)
      @title = title
      @description = description
      @block = block
    end

    def view_template(&block)
      (@block || block)&.call(self)

      div(class: "rounded-xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/70 dark:bg-red-950/20") do
        h2(class: "text-sm font-semibold text-red-800 dark:text-red-300") { @title }
        p(class: "mt-1 max-w-2xl text-xs leading-5 text-red-700/80 dark:text-red-300/70") { @description } if @description
        div(class: "mt-4 flex flex-wrap gap-2") { @confirmation&.call }
      end
    end

    def confirmation(&block)
      @confirmation = block
    end
  end
end
