module Ink
  class RadioButtonGroup < Component
    def initialize(legend:, name:, options:, value: nil, **html)
      @legend = legend
      @name = name
      @options = options
      @value = value
      @html = html
    end

    def view_template
      fieldset(**@html) do
        legend(class: "mb-2 text-xs font-semibold text-foreground") { @legend }
        div(class: "grid gap-2") do
          @options.each do |choice|
            selected = choice.instance_variable_get(:@value).to_s == @value.to_s
            label(class: "flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/80 p-3 text-[13px] transition-colors hover:bg-muted/40 #{"border-primary/60 bg-primary/5" if selected}") do
              input(type: "radio", name: @name, value: choice.instance_variable_get(:@value), checked: selected, class: "mt-0.5 h-4 w-4 accent-primary")
              span do
                span(class: "block font-medium leading-5 text-foreground") { choice.instance_variable_get(:@label) }
                description = choice.instance_variable_get(:@description)
                span(class: "mt-0.5 block text-xs text-muted-foreground") { description } if description
              end
            end
          end
        end
      end
    end
  end
end
