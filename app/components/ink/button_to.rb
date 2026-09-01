module Ink
  # Form-backed button for non-GET actions (uses button_to semantics).
  class ButtonTo < Component
    include Phlex::Rails::Helpers::ButtonTo

    def initialize(text, href:, method: :post, variant: :secondary, size: :md, icon: nil, **html)
      @text = text
      @href = href
      @method = method
      @variant = variant
      @size = size
      @icon = icon
      @html = html
    end

    def view_template
      data = @html.delete(:data)
      aria = @html.delete(:button_aria) || @html.delete(:aria)
      classes = "inline-flex shrink-0 items-center justify-center rounded-lg font-semibold tracking-[-0.01em] whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 #{Button::VARIANT_CLASSES[@variant] || Button::VARIANT_CLASSES[:secondary]} #{Button::SIZE_CLASSES[@size] || Button::SIZE_CLASSES[:md]}"

      button_to @href, method: @method, form: { class: "inline-flex", data: data },
        class: classes, aria: aria, **@html do
        render Ink::Icon.new(@icon, size: @size == :xs ? :xs : :sm) if @icon
        span { @text }
      end
    end
  end
end
