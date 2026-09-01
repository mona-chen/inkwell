require "lucide-rails"

module Ink
  # Stroke-based Lucide icon. Names use snake_case (e.g. :chevron_right, :arrow_left).
  class Icon < Component
    SIZES = { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 }.freeze

    def initialize(name, size: :md, label: nil, class_name: nil)
      @name = name.to_s.tr("_", "-")
      @size = SIZES.fetch(size, 16)
      @label = label
      @class_name = class_name
      @path = LucideRails::IconProvider.icon(@name)
      raise ArgumentError, "Unknown icon #{@name.inspect}" unless @path
    end

    def view_template
      svg(
        width: @size, height: @size, viewBox: "0 0 24 24", fill: "none",
        stroke: "currentColor", stroke_width: "1.75", stroke_linecap: "round",
        stroke_linejoin: "round", focusable: "false",
        class: "ink-icon #{@class_name}".strip,
        aria: @label ? { label: @label, hidden: false } : { hidden: true }
      ) { raw(@path.html_safe) }
    end
  end
end
