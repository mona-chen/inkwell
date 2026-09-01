module Ink
  class Choice < Component
    def initialize(label: nil, value: nil, description: nil, options: nil, selected: nil, name: nil, **html)
      @label = label; @value = value; @description = description; @options = options; @selected = selected; @name = name; @html = html
    end

    def view_template
      return if @options.nil?

      div(class: "grid gap-2", **@html) do
        @options.each do |opt|
          val = opt.is_a?(Array) ? opt[1] : opt
          lab = opt.is_a?(Array) ? opt[0] : opt
          label(class: "flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/80 p-3 text-[13px] transition-colors hover:bg-muted/40 #{"border-primary/60 bg-primary/5" if val == @selected}") do
            input(type: "radio", name: @name, value: val, checked: val == @selected, class: "mt-0.5 h-4 w-4 accent-primary")
            span(class: "leading-5") { lab }
          end
        end
      end
    end
  end
end
