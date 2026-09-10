module Ink
  class FormBuilder < ActionView::Helpers::FormBuilder
    def group(&block)
      @template.tag.div(class: "flex flex-col gap-3", &block)
    end

    def field(name, as: :text, label: nil, description: nil, control_html: {}, **html)
      return switch_field(name, html, label: label) if as == :switch

      @template.tag.div(class: "mb-3") do
        safe = []
        safe << @template.label(object_name, name, label || name.to_s.humanize, for: field_id(name), class: "mb-1.5 block text-xs font-medium text-foreground") if label != false
        safe << input(name, as, html.merge(control_html))
        safe << @template.content_tag(:p, description, class: "mt-1 text-xs text-muted-foreground") if description.present?
        @template.safe_join(safe)
      end
    end

    def submit(value = nil, options = {})
      supplied_class = options.delete(:class)
      options[:class] = [
        "inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
        supplied_class
      ].compact.join(" ")
      super(value, options)
    end

    def switch_field(name, opts = {}, label: nil)
      label_text = label || opts.delete(:label) || name.to_s.humanize
      checked = opts.key?(:checked) ? opts.delete(:checked) : (object&.public_send("#{name}?") rescue false)
      value = opts.delete(:value) || "1"
      hidden = @template.hidden_field_tag("#{object_name}[#{name}]", "0", id: nil)
      toggle = @template.check_box_tag("#{object_name}[#{name}]", value, checked, class: "peer sr-only", id: field_id(name))
      @template.tag.label(for: field_id(name), class: "flex cursor-pointer items-center justify-between gap-4 rounded-lg py-1") do
        label_node = @template.content_tag(:span, label_text, class: "text-xs font-medium text-foreground")
        control = @template.content_tag(:span, "", class: "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-border transition-colors after:absolute after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-focus-visible:ring-2 peer-focus-visible:ring-ring/30 peer-checked:bg-primary peer-checked:after:translate-x-4")
        @template.safe_join([hidden, toggle, label_node, control])
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
