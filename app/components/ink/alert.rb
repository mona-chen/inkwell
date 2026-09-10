module Ink
  class Alert < Component
    VARIANT_CLASSES = {
      info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
      success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
      warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
      error: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
    }.freeze

    def initialize(variant: :info, title: nil, &block)
      @variant = variant
      @title = title
      @block = block
    end

    def view_template
      div(class: "p-3 text-sm border #{VARIANT_CLASSES[@variant] || VARIANT_CLASSES[:info]}", role: "alert") do
        strong(class: "font-semibold block mb-0.5") { @title } if @title
        @block&.call
      end
    end
  end
end
