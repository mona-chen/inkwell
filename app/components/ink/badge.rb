module Ink
  class Badge < Component
    VARIANTS = %i[default secondary destructive outline ghost].freeze
    COLORS = %i[neutral info success warning danger primary].freeze
    SIZES = %i[xs sm md].freeze

    VARIANT_CLASSES = {
      default: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      destructive: "bg-destructive text-destructive-foreground",
      outline: "border border-border text-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground"
    }.freeze

    COLOR_CLASSES = {
      neutral: "bg-secondary text-secondary-foreground",
      primary: "bg-primary text-primary-foreground",
      success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    }.freeze

    SIZE_CLASSES = {
      xs: "h-4 px-1.5 text-[10px]",
      sm: "h-5 px-2 text-[11px]",
      md: "h-6 px-2.5 text-xs"
    }.freeze

    def initialize(text = nil, variant: nil, color: nil, size: :md, &block)
      @text = text
      @variant = variant && VARIANTS.include?(variant) ? variant : nil
      @color = color && COLORS.include?(color) ? color : :neutral
      @size = SIZE_CLASSES.key?(size) ? size : :md
      @block = block
    end

    def view_template
      badge_class = @variant ? VARIANT_CLASSES[@variant] : COLOR_CLASSES[@color]
      span(class: "inline-flex items-center gap-1 rounded-full font-medium border border-transparent #{badge_class} #{SIZE_CLASSES[@size]}") do
        @block ? @block.call : plain(@text.to_s)
      end
    end
  end
end
