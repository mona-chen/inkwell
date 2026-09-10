module Ink
  class Checkbox < Component
    def initialize(label:, checked: false, name: nil, value: "1", unchecked_value: nil, **html)
      @label = label; @checked = checked; @name = name; @value = value; @unchecked_value = unchecked_value; @html = html
    end

    def view_template
      label(class: "flex cursor-pointer items-start gap-2.5 text-[13px] text-foreground") do
        input(type: "hidden", name: @name, value: @unchecked_value) if @unchecked_value
        input(type: "checkbox", checked: @checked, name: @name, value: @value, class: "mt-0.5 h-4 w-4 rounded border-border accent-primary", **@html)
        span(class: "leading-5") { @label }
      end
    end
  end
end
