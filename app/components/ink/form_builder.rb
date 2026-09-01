module Ink
  class FormBuilder < ActionView::Helpers::FormBuilder
    def group(&block)
      @template.tag.div(class: "flex flex-col gap-3", &block)
    end

    def field(name, as: :text, label: nil, **html)
      @template.tag.div(class: "mb-3") do
        safe = []
        safe << @template.label(object_name, name, label || name.to_s.humanize, for: field_id(name), class: "mb-1.5 block text-xs font-medium text-foreground") if label != false
        safe << input(name, as, html)
        @template.safe_join(safe)
      end
    end

    def switch_field(name, opts = {}, label: nil)
      label_text = label || opts.delete(:label) || name.to_s.humanize
      checked = object&.public_send("#{name}?") rescue false
      hidden = @template.hidden_field_tag("#{object_name}[#{name}]", "0", id: nil)
      toggle = @template.check_box_tag("#{object_name}[#{name}]", "1", checked, class: "peer sr-only", id: field_id(name))
      @template.tag.div(class: "flex items-center justify-between py-1") do
        @template.content_tag(:span, label_text, class: "text-xs font-medium text-foreground")
        @template.content_tag(:span, class: "relative inline-flex cursor-pointer items-center") do
          [hidden, toggle, @template.content_tag(:span, "", class: "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-sm ring-0 transition-transform peer-checked:translate-x-5 peer-checked:bg-primary dark:peer-checked:bg-primary")].join.html_safe
        end.html_safe
      end
    end

    private

    def field_id(name)
      "#{object_name}_#{name}"
    end

    def input(name, as, html)
      opts = html.dup
      value = opts.delete(:value)
      choices = opts.delete(:options) || opts.delete(:choices) || []
      include_blank = opts.delete(:include_blank)
      supplied_class = opts.delete(:class)
      opts[:class] = [css_for(as), supplied_class].compact.join(" ")
      opts[:id] ||= field_id(name)
      case as
      when :textarea
        text_area(name, opts.merge(value: value))
      when :select
        select(name, choices, { selected: value, include_blank: include_blank }, opts)
      when :checkbox
        check_box(name, opts, "1", "0")
      else
        input_type = as == :string ? :text : as
        public_send("#{input_type}_field", name, opts.merge(value: value))
      end
    end

    def css_for(as)
      return "h-4 w-4 rounded border-input accent-primary" if as == :checkbox

      base = "w-full rounded-lg border border-input bg-background px-3 text-[13px] text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
      case as
      when :textarea then base + " min-h-24 resize-y py-2"
      when :select then base + " h-9 pr-9 ink-select-chevron"
      else base + " h-9"
      end
    end
  end
end
